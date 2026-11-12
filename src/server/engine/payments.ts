import { createHash } from "node:crypto";
import { getBank } from "@/lib/catalog/banks";
import { getBettingProvider } from "@/lib/catalog/betting";
import { getCablePlan, getCableProvider, getDisco, getInternetPlan, getInternetProvider, getUtilityBiller } from "@/lib/catalog/billers";
import { getMerchant } from "@/lib/catalog/merchants";
import { getBundle, getNetwork } from "@/lib/catalog/networks";
import { feeFor } from "@/lib/fees";
import { formatPhone, lagosDayKey, lagosMonthKey, maskAccountNumber } from "@/lib/format";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type { SummaryRow, Transaction, TransactionDetails, TransactionType } from "@/lib/types";
import {
  cardPurchaseSchema,
  creditSchema,
  executionEnvelopeSchema,
  fieldErrorsFrom,
  paymentRequestSchema,
  type ExecutionEnvelope,
  type PaymentRequest,
} from "@/lib/validation";
import { verifySecret } from "../auth/crypto";
import { AppError, Errors } from "../errors";
import type { ProviderOutcome, ProviderRegistry } from "../providers/types";
import type { BankRepository, PostingIntent } from "../repository/types";

export interface EngineDeps {
  repo: BankRepository;
  providers: ProviderRegistry;
}

export interface Quote {
  kind: PaymentRequest["kind"];
  type: TransactionType;
  amount: number;
  fee: number;
  total: number;
  description: string;
  narration: string | null;
  details: TransactionDetails;
  /** Rows for the confirmation screen, built on the server. */
  rows: SummaryRow[];
  recipientTitle: string;
  recipientSubtitle: string;
  provider: string;
  /** Fields that identify *where* money goes; part of the idempotency fingerprint. */
  identity: string;
}

export interface ExecutionResult {
  transaction: Transaction;
  replayed: boolean;
  balance: number;
}

function requireAmount(value: string): number {
  const kobo = parseNairaToKobo(value);
  if (kobo === null || kobo <= 0) throw new AppError("VALIDATION", "Enter a valid amount.", { amount: "Enter a valid amount" });
  return kobo;
}

function fingerprint(quote: Pick<Quote, "type" | "amount" | "fee" | "identity">): string {
  return createHash("sha256").update(JSON.stringify([quote.type, quote.amount, quote.fee, quote.identity])).digest("hex");
}

/** Validate an untrusted payment request; throws a VALIDATION AppError with field messages. */
export function parsePaymentRequest(raw: unknown): PaymentRequest {
  const parsed = paymentRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    const cleaned = Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k.replace(/^input\./, ""), v]));
    throw new AppError("VALIDATION", "Please check the highlighted fields.", cleaned);
  }
  return parsed.data;
}

/**
 * Price and describe a payment entirely on the server: amounts for plan-based
 * products come from the catalogue, fees from the fee schedule, and recipient
 * names from the verification provider — never from the client.
 */
export async function buildQuote(deps: EngineDeps, request: PaymentRequest): Promise<Quote> {
  const { providers } = deps;
  switch (request.kind) {
    case "transfer": {
      const { bankCode, accountNumber, narration } = request.input;
      const bank = getBank(bankCode)!;
      const amount = requireAmount(request.input.amount);
      const lookup = await providers.verification.resolveAccount({ bankCode, accountNumber });
      if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { accountNumber: lookup.reason });
      const fee = feeFor("transfer", amount);
      return {
        kind: "transfer",
        type: "transfer",
        amount,
        fee,
        total: amount + fee,
        description: `Transfer to ${lookup.accountName.replace(/\b\w+/g, (w) => w.charAt(0) + w.slice(1).toLowerCase())}`,
        narration: narration || null,
        details: { recipientName: lookup.accountName, bankCode, bankName: bank.name, accountNumberMasked: maskAccountNumber(accountNumber) },
        rows: [
          { label: "Recipient", value: lookup.accountName, emphasis: true },
          { label: "Bank", value: bank.name },
          { label: "Account number", value: maskAccountNumber(accountNumber), mono: true },
          ...(narration ? [{ label: "Narration", value: narration }] : []),
        ],
        recipientTitle: lookup.accountName,
        recipientSubtitle: `${bank.name} · ${maskAccountNumber(accountNumber)}`,
        provider: providers.transfers.name,
        identity: `${bankCode}:${accountNumber}`,
      };
    }
    case "airtime": {
      const { network, phone } = request.input;
      const net = getNetwork(network)!;
      const amount = requireAmount(request.input.amount);
      return {
        kind: "airtime",
        type: "airtime",
        amount,
        fee: feeFor("airtime", amount),
        total: amount + feeFor("airtime", amount),
        description: `${net.name} airtime`,
        narration: null,
        details: { network, networkName: net.name, phone },
        rows: [
          { label: "Network", value: net.name },
          { label: "Phone number", value: formatPhone(phone), mono: true, emphasis: true },
        ],
        recipientTitle: formatPhone(phone),
        recipientSubtitle: `${net.name} airtime`,
        provider: providers.telco.name,
        identity: `${network}:${phone}`,
      };
    }
    case "data": {
      const { network, phone, bundleId } = request.input;
      const net = getNetwork(network)!;
      const bundle = getBundle(bundleId)!;
      return {
        kind: "data",
        type: "data",
        amount: bundle.price,
        fee: feeFor("data", bundle.price),
        total: bundle.price + feeFor("data", bundle.price),
        description: `${net.name} ${bundle.name}`,
        narration: null,
        details: { network, networkName: net.name, phone, planId: bundle.id, planName: bundle.name, validity: bundle.validity },
        rows: [
          { label: "Network", value: net.name },
          { label: "Phone number", value: formatPhone(phone), mono: true, emphasis: true },
          { label: "Bundle", value: `${bundle.volume} · ${bundle.validity}` },
        ],
        recipientTitle: formatPhone(phone),
        recipientSubtitle: `${net.name} · ${bundle.volume} for ${bundle.validity}`,
        provider: providers.telco.name,
        identity: `${network}:${phone}:${bundle.id}`,
      };
    }
    case "electricity": {
      const { discoId, meterNumber, meterType } = request.input;
      const disco = getDisco(discoId)!;
      const amount = requireAmount(request.input.amount);
      const lookup = await providers.bills.verifyCustomer({ service: "electricity", billerId: discoId, customerId: meterNumber, meterType });
      if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { meterNumber: lookup.reason });
      const fee = feeFor("electricity", amount);
      return {
        kind: "electricity",
        type: "electricity",
        amount,
        fee,
        total: amount + fee,
        description: `${disco.name} ${meterType}`,
        narration: null,
        details: { providerId: disco.id, providerName: disco.name, customerId: meterNumber, customerName: lookup.customerName, meterType },
        rows: [
          { label: "Provider", value: disco.name },
          { label: "Customer", value: lookup.customerName, emphasis: true },
          ...(lookup.address ? [{ label: "Address", value: lookup.address }] : []),
          { label: "Meter number", value: meterNumber, mono: true },
          { label: "Meter type", value: meterType === "prepaid" ? "Prepaid" : "Postpaid" },
        ],
        recipientTitle: lookup.customerName,
        recipientSubtitle: `${disco.shortName} · Meter ${meterNumber}`,
        provider: providers.bills.name,
        identity: `${discoId}:${meterNumber}:${meterType}`,
      };
    }
    case "cable_tv": {
      const { providerId, smartcardNumber, planId } = request.input;
      const provider = getCableProvider(providerId)!;
      const plan = getCablePlan(planId)!;
      const lookup = await providers.bills.verifyCustomer({ service: "cable_tv", billerId: providerId, customerId: smartcardNumber });
      if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { smartcardNumber: lookup.reason });
      const fee = feeFor("cable_tv", plan.price);
      return {
        kind: "cable_tv",
        type: "cable_tv",
        amount: plan.price,
        fee,
        total: plan.price + fee,
        description: plan.name,
        narration: null,
        details: { providerId, providerName: provider.name, customerId: smartcardNumber, customerName: lookup.customerName, planId, planName: plan.name, validity: plan.validity },
        rows: [
          { label: "Provider", value: provider.name },
          { label: "Customer", value: lookup.customerName, emphasis: true },
          { label: provider.identifierLabel, value: smartcardNumber, mono: true },
          { label: "Plan", value: `${plan.name} · ${plan.validity}` },
        ],
        recipientTitle: lookup.customerName,
        recipientSubtitle: `${provider.name} · ${smartcardNumber}`,
        provider: providers.bills.name,
        identity: `${providerId}:${smartcardNumber}:${planId}`,
      };
    }
    case "internet": {
      const { providerId, customerId, planId } = request.input;
      const provider = getInternetProvider(providerId)!;
      const plan = getInternetPlan(planId)!;
      const lookup = await providers.bills.verifyCustomer({ service: "internet", billerId: providerId, customerId });
      if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { customerId: lookup.reason });
      const fee = feeFor("internet", plan.price);
      return {
        kind: "internet",
        type: "internet",
        amount: plan.price,
        fee,
        total: plan.price + fee,
        description: plan.name,
        narration: null,
        details: { providerId, providerName: provider.name, customerId, customerName: lookup.customerName, planId, planName: plan.name, validity: plan.validity },
        rows: [
          { label: "Provider", value: provider.name },
          { label: "Customer", value: lookup.customerName, emphasis: true },
          { label: provider.identifierLabel, value: customerId, mono: true },
          { label: "Plan", value: `${plan.name} · ${plan.validity}` },
        ],
        recipientTitle: lookup.customerName,
        recipientSubtitle: `${provider.name} · ${customerId}`,
        provider: providers.bills.name,
        identity: `${providerId}:${customerId}:${planId}`,
      };
    }
    case "utility": {
      const { billerId, customerId } = request.input;
      const biller = getUtilityBiller(billerId)!;
      const amount = requireAmount(request.input.amount);
      const lookup = await providers.bills.verifyCustomer({ service: "utility", billerId, customerId });
      if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { customerId: lookup.reason });
      const fee = feeFor("utility", amount);
      return {
        kind: "utility",
        type: "utility",
        amount,
        fee,
        total: amount + fee,
        description: biller.name,
        narration: null,
        details: { providerId: billerId, providerName: biller.name, customerId, customerName: lookup.customerName },
        rows: [
          { label: "Biller", value: biller.name },
          { label: "Customer", value: lookup.customerName, emphasis: true },
          { label: biller.identifierLabel, value: customerId, mono: true },
        ],
        recipientTitle: lookup.customerName,
        recipientSubtitle: `${biller.name} · ${customerId}`,
        provider: providers.bills.name,
        identity: `${billerId}:${customerId}`,
      };
    }
    case "betting": {
      const { providerId, customerId } = request.input;
      const platform = getBettingProvider(providerId)!;
      const amount = requireAmount(request.input.amount);
      const lookup = await providers.betting.verifyCustomer({ providerId, customerId });
      if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { customerId: lookup.reason });
      const fee = feeFor("betting", amount);
      return {
        kind: "betting",
        type: "betting",
        amount,
        fee,
        total: amount + fee,
        description: `${platform.name} wallet funding`,
        narration: null,
        details: { providerId, providerName: platform.name, customerId, customerName: lookup.customerName },
        rows: [
          { label: "Platform", value: platform.name },
          { label: "Account holder", value: lookup.customerName, emphasis: true },
          { label: "Customer ID", value: customerId, mono: true },
        ],
        recipientTitle: lookup.customerName,
        recipientSubtitle: `${platform.name} · ${customerId}`,
        provider: providers.betting.name,
        identity: `${providerId}:${customerId}`,
      };
    }
  }
}

function toIntent(quote: Quote): PostingIntent {
  return {
    type: quote.type,
    direction: "debit",
    amount: quote.amount,
    fee: quote.fee,
    description: quote.description,
    narration: quote.narration,
    details: quote.details,
    provider: quote.provider,
    fingerprint: fingerprint(quote),
  };
}

async function callProvider(deps: EngineDeps, request: PaymentRequest, quote: Quote, reference: string): Promise<ProviderOutcome> {
  const { providers } = deps;
  switch (request.kind) {
    case "transfer":
      return providers.transfers.sendTransfer({
        reference,
        bankCode: request.input.bankCode,
        accountNumber: request.input.accountNumber,
        accountName: quote.details.recipientName ?? "",
        amount: quote.amount,
        narration: quote.narration,
      });
    case "airtime":
      return providers.telco.purchaseAirtime({ reference, network: request.input.network, phone: request.input.phone, amount: quote.amount });
    case "data":
      return providers.telco.purchaseData({ reference, network: request.input.network, phone: request.input.phone, bundleId: request.input.bundleId, amount: quote.amount });
    case "electricity":
      return providers.bills.payBill({ reference, service: "electricity", billerId: request.input.discoId, customerId: request.input.meterNumber, amount: quote.amount, meterType: request.input.meterType });
    case "cable_tv":
      return providers.bills.payBill({ reference, service: "cable_tv", billerId: request.input.providerId, customerId: request.input.smartcardNumber, amount: quote.amount, planId: request.input.planId });
    case "internet":
      return providers.bills.payBill({ reference, service: "internet", billerId: request.input.providerId, customerId: request.input.customerId, amount: quote.amount, planId: request.input.planId });
    case "utility":
      return providers.bills.payBill({ reference, service: "utility", billerId: request.input.billerId, customerId: request.input.customerId, amount: quote.amount });
    case "betting":
      return providers.betting.fundWallet({ reference, providerId: request.input.providerId, customerId: request.input.customerId, amount: quote.amount });
  }
}

/** Enforce the transaction PIN when the user has set one. */
export async function verifyTransactionPin(deps: EngineDeps, userId: string, pin: string | undefined): Promise<void> {
  const record = await deps.repo.getPinRecord(userId);
  if (!record.pinHash) return;
  if (record.lockedUntil && new Date(record.lockedUntil).getTime() > Date.now()) {
    throw new AppError("PIN_LOCKED", "Too many incorrect PIN attempts. Try again in 15 minutes.");
  }
  if (!pin) throw new AppError("PIN_REQUIRED", "Enter your 4-digit transaction PIN to continue.");
  const ok = await verifySecret(pin, record.pinHash);
  const after = await deps.repo.recordPinAttempt(userId, ok);
  if (!ok) {
    if (after.lockedUntil) throw new AppError("PIN_LOCKED", "Too many incorrect PIN attempts. Your PIN is locked for 15 minutes.");
    throw new AppError("PIN_INVALID", "Incorrect PIN. Please try again.", { pin: "Incorrect PIN" });
  }
}

async function notifyOutcome(deps: EngineDeps, userId: string, txn: Transaction) {
  const amount = formatNaira(txn.total);
  const link = `/transactions?ref=${txn.reference}`;
  if (txn.status === "successful") {
    await deps.repo.createNotification(userId, { kind: "transaction", title: `Debit: ${amount}`, body: `${txn.description} was successful.`, link });
  } else if (txn.status === "failed") {
    await deps.repo.createNotification(userId, { kind: "transaction", title: "Payment failed — money returned", body: `${txn.description}: ${txn.failureReason ?? "declined"}`, link });
  } else if (txn.status === "pending") {
    await deps.repo.createNotification(userId, { kind: "transaction", title: "Payment pending", body: `${txn.description} is awaiting provider confirmation. You can check its status from your transactions.`, link });
  }
  const [prefs, account] = await Promise.all([deps.repo.getPreferences(userId), deps.repo.getAccount(userId)]);
  if (prefs?.lowBalanceAlert && account && txn.direction === "debit" && txn.status !== "failed" && account.balance < prefs.lowBalanceThreshold) {
    await deps.repo.createNotification(userId, {
      kind: "system",
      title: "Low balance alert",
      body: `Your balance is ${formatNaira(account.balance)}, below your ${formatNaira(prefs.lowBalanceThreshold)} alert threshold.`,
      link: "/overview",
    });
  }
}

/**
 * Execute a payment:
 *   1. validate input + envelope, re-quote on the server, and require the user
 *      to have confirmed exactly this total;
 *   2. verify the transaction PIN (if set);
 *   3. atomically reserve (debit) funds — idempotent on the submission key;
 *   4. call the provider adapter;
 *   5. settle: success, failure (auto-reversal) or pending (await requery).
 */
export async function executePayment(deps: EngineDeps, userId: string, rawRequest: unknown, rawEnvelope: unknown): Promise<ExecutionResult> {
  const request = parsePaymentRequest(rawRequest);
  const envelopeResult = executionEnvelopeSchema.safeParse(rawEnvelope);
  if (!envelopeResult.success) throw new AppError("VALIDATION", "Invalid submission. Please review and try again.", fieldErrorsFrom(envelopeResult.error));
  const envelope: ExecutionEnvelope = envelopeResult.data;

  const quote = await buildQuote(deps, request);
  if (quote.total !== envelope.confirmedTotal) throw Errors.quoteChanged();

  await verifyTransactionPin(deps, userId, envelope.pin);

  const { transaction: reserved, replayed } = await deps.repo.reserveDebit(userId, envelope.idempotencyKey, toIntent(quote));
  if (replayed) {
    const account = await deps.repo.getAccount(userId);
    return { transaction: reserved, replayed: true, balance: account?.balance ?? 0 };
  }

  let outcome: ProviderOutcome;
  try {
    outcome = await callProvider(deps, request, quote, reserved.reference);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_CONFIGURED") {
      // Nothing was sent anywhere: release the reservation immediately.
      outcome = { status: "failed", providerReference: null, failureReason: error.message };
    } else {
      // Unknown outcome: keep it pending for requery instead of guessing.
      console.error("[eleos] provider call failed with unknown outcome", { reference: reserved.reference, error });
      outcome = { status: "pending", providerReference: null };
    }
  }

  const settled = await deps.repo.settleTransaction(userId, reserved.id, {
    status: outcome.status,
    providerReference: outcome.providerReference,
    failureReason: outcome.failureReason ?? null,
    details: outcome.details,
  });

  if (request.kind === "transfer" && settled.status !== "failed") {
    const existing = await deps.repo.findBeneficiary(userId, request.input.bankCode, request.input.accountNumber);
    if (existing) {
      await deps.repo.touchBeneficiary(userId, existing.id);
    } else if (request.input.saveBeneficiary) {
      await deps.repo
        .createBeneficiary(userId, {
          bankCode: request.input.bankCode,
          bankName: getBank(request.input.bankCode)!.name,
          accountNumber: request.input.accountNumber,
          accountName: quote.details.recipientName ?? "",
          nickname: request.input.nickname || null,
        })
        .catch((error) => {
          if (!(error instanceof AppError && error.code === "DUPLICATE")) throw error;
        });
    }
  }

  await notifyOutcome(deps, userId, settled);
  const account = await deps.repo.getAccount(userId);
  return { transaction: settled, replayed: false, balance: account?.balance ?? 0 };
}

/** Ask the provider for the final status of a PENDING transaction and settle it. */
export async function refreshPendingTransaction(deps: EngineDeps, userId: string, transactionId: string): Promise<Transaction> {
  const txn = await deps.repo.getTransaction(userId, transactionId);
  if (!txn) throw Errors.notFound("Transaction");
  if (txn.status !== "pending") return txn;
  const { providers } = deps;
  const input = { reference: txn.reference, providerReference: txn.providerReference, type: txn.type, amount: txn.amount, createdAt: txn.createdAt, details: txn.details };
  let outcome: ProviderOutcome;
  switch (txn.type) {
    case "transfer":
      outcome = await providers.transfers.requery(input);
      break;
    case "airtime":
    case "data":
      outcome = await providers.telco.requery(input);
      break;
    case "betting":
      outcome = await providers.betting.requery(input);
      break;
    default:
      outcome = await providers.bills.requery(input);
  }
  if (outcome.status === "pending") return txn;
  const settled = await deps.repo.settleTransaction(userId, txn.id, {
    status: outcome.status,
    providerReference: outcome.providerReference,
    failureReason: outcome.failureReason ?? null,
    details: outcome.details,
  });
  await notifyOutcome(deps, userId, settled);
  return settled;
}

const CREDIT_SOURCES = {
  salary: { description: "Salary — Brightline Technologies Ltd", senderName: "BRIGHTLINE TECHNOLOGIES LTD", bankName: "Guaranty Trust Bank" },
  transfer: { description: "Transfer from Kelechi Okafor", senderName: "KELECHI DAVID OKAFOR", bankName: "Fidelity Bank" },
  refund: { description: "Refund — Jumia order", senderName: "JUMIA NIGERIA", bankName: "Access Bank" },
  topup: { description: "Account top-up", senderName: "ELEOS FUNDING", bankName: "Eleos" },
} as const;

/** Simulate an incoming credit (salary, transfer, refund or a plain demo top-up). */
export async function postDemoCredit(deps: EngineDeps, userId: string, rawInput: unknown, idempotencyKey: string): Promise<ExecutionResult> {
  const parsed = creditSchema.safeParse(rawInput);
  if (!parsed.success) throw new AppError("VALIDATION", "Please check the highlighted fields.", fieldErrorsFrom(parsed.error));
  const amount = requireAmount(parsed.data.amount);
  const source = CREDIT_SOURCES[parsed.data.source];
  const intent: PostingIntent = {
    type: "credit",
    direction: "credit",
    amount,
    fee: 0,
    description: source.description,
    narration: "Incoming credit",
    details: { senderName: source.senderName, bankName: source.bankName, source: parsed.data.source },
    provider: "demo",
    fingerprint: fingerprint({ type: "credit", amount, fee: 0, identity: parsed.data.source }),
  };
  const { transaction, replayed } = await deps.repo.postCredit(userId, idempotencyKey, intent);
  if (!replayed) {
    await deps.repo.createNotification(userId, {
      kind: "transaction",
      title: `Credit: ${formatNaira(amount)}`,
      body: `${source.description}.`,
      link: `/transactions?ref=${transaction.reference}`,
    });
  }
  const account = await deps.repo.getAccount(userId);
  return { transaction, replayed, balance: account?.balance ?? 0 };
}

/** Simulate a purchase on the demo virtual card, honouring freeze state and spending limits. */
export async function simulateCardPurchase(deps: EngineDeps, userId: string, rawInput: unknown, idempotencyKey: string): Promise<ExecutionResult> {
  const parsed = cardPurchaseSchema.safeParse(rawInput);
  if (!parsed.success) throw new AppError("VALIDATION", "Please check the highlighted fields.", fieldErrorsFrom(parsed.error));
  const merchant = getMerchant(parsed.data.merchantId)!;
  const amount = requireAmount(parsed.data.amount);
  const card = await deps.repo.getCard(userId);
  if (!card) throw Errors.notFound("Card");

  const intent: PostingIntent = {
    type: "card",
    direction: "debit",
    amount,
    fee: 0,
    description: `Card · ${merchant.name}`,
    narration: null,
    details: { merchant: merchant.name, merchantCategory: merchant.category, cardLast4: card.last4 },
    provider: "demo-card",
    fingerprint: fingerprint({ type: "card", amount, fee: 0, identity: merchant.id }),
  };

  let declineReason: string | null = null;
  if (card.frozen) declineReason = "Declined: card is frozen.";
  else if (!card.onlinePayments) declineReason = "Declined: online payments are disabled for this card.";
  else {
    const now = new Date();
    const monthStart = new Date(Date.now() - 32 * 86_400_000).toISOString();
    const recent = await deps.repo.listRecentTransactions(userId, monthStart);
    const cardSpend = recent.filter((t) => t.type === "card" && (t.status === "successful" || t.status === "pending"));
    const today = cardSpend.filter((t) => lagosDayKey(t.createdAt) === lagosDayKey(now)).reduce((s, t) => s + t.total, 0);
    const month = cardSpend.filter((t) => lagosMonthKey(t.createdAt) === lagosMonthKey(now)).reduce((s, t) => s + t.total, 0);
    if (today + amount > card.dailyLimit) declineReason = `Declined: exceeds your daily card limit of ${formatNaira(card.dailyLimit)}.`;
    else if (month + amount > card.monthlyLimit) declineReason = `Declined: exceeds your monthly card limit of ${formatNaira(card.monthlyLimit)}.`;
  }

  if (declineReason) {
    const { transaction, replayed } = await deps.repo.recordDeclined(userId, idempotencyKey, intent, declineReason);
    const account = await deps.repo.getAccount(userId);
    return { transaction, replayed, balance: account?.balance ?? 0 };
  }

  const { transaction: reserved, replayed } = await deps.repo.reserveDebit(userId, idempotencyKey, intent);
  if (replayed) {
    const account = await deps.repo.getAccount(userId);
    return { transaction: reserved, replayed, balance: account?.balance ?? 0 };
  }
  const settled = await deps.repo.settleTransaction(userId, reserved.id, { status: "successful", providerReference: `AUTH-${reserved.id.slice(0, 6).toUpperCase()}` });
  await notifyOutcome(deps, userId, settled);
  const account = await deps.repo.getAccount(userId);
  return { transaction: settled, replayed: false, balance: account?.balance ?? 0 };
}
