"use server";

import { z } from "zod";
import type { ActionResult, SummaryRow, Transaction } from "@/lib/types";
import { bankCodeField, nubanField, type PaymentRequestInput } from "@/lib/validation";
import { parseOrThrow, requireActionUser, revalidateApp, runAction } from "@/server/action-utils";
import { getEngineDeps } from "@/server/context";
import {
  buildQuote,
  executePayment,
  parsePaymentRequest,
  postDemoCredit,
  refreshPendingTransaction,
  simulateCardPurchase,
} from "@/server/engine/payments";
import { AppError } from "@/server/errors";

export interface QuoteView {
  amount: number;
  fee: number;
  total: number;
  description: string;
  rows: SummaryRow[];
  recipientTitle: string;
  recipientSubtitle: string;
  requiresPin: boolean;
  availableBalance: number;
}

export interface PaymentOutcome {
  transaction: Transaction;
  balance: number;
  replayed: boolean;
}

/** Resolve an account name for the transfer form (simulated in demo mode). */
export async function verifyAccountAction(input: { bankCode: string; accountNumber: string }): Promise<
  ActionResult<{ accountName: string; savedBeneficiaryId: string | null }>
> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { bankCode, accountNumber } = parseOrThrow(z.object({ bankCode: bankCodeField, accountNumber: nubanField }), input);
    const deps = await getEngineDeps();
    const saved = await deps.repo.findBeneficiary(user.id, bankCode, accountNumber);
    const lookup = await deps.providers.verification.resolveAccount({ bankCode, accountNumber });
    if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { accountNumber: lookup.reason });
    return { accountName: lookup.accountName, savedBeneficiaryId: saved?.id ?? null };
  });
}

/** Server-side quote shown on the confirmation screen. */
export async function quotePaymentAction(request: PaymentRequestInput): Promise<ActionResult<QuoteView>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const deps = await getEngineDeps();
    const parsed = parsePaymentRequest(request);
    const [quote, account, security] = await Promise.all([
      buildQuote(deps, parsed),
      deps.repo.getAccount(user.id),
      deps.repo.getSecurityStatus(user.id),
    ]);
    if (!account) throw new AppError("NOT_FOUND", "Account was not found.");
    if (account.balance < quote.total) {
      throw new AppError("INSUFFICIENT_FUNDS", "Insufficient balance for this transaction, including fees.", { amount: "Amount plus fee exceeds your available balance" });
    }
    return {
      amount: quote.amount,
      fee: quote.fee,
      total: quote.total,
      description: quote.description,
      rows: quote.rows,
      recipientTitle: quote.recipientTitle,
      recipientSubtitle: quote.recipientSubtitle,
      requiresPin: security.hasPin,
      availableBalance: account.balance,
    };
  });
}

export async function executePaymentAction(
  request: PaymentRequestInput,
  envelope: { idempotencyKey: string; confirmedTotal: number; pin?: string },
): Promise<ActionResult<PaymentOutcome>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    return executePayment(await getEngineDeps(), user.id, request, envelope);
  });
  revalidateApp();
  return result;
}

export async function addDemoFundsAction(input: { amount: string; source: string }, idempotencyKey: string): Promise<ActionResult<PaymentOutcome>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    parseOrThrow(z.uuid(), idempotencyKey);
    return postDemoCredit(await getEngineDeps(), user.id, input, idempotencyKey);
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function simulateCardPurchaseAction(input: { merchantId: string; amount: string }, idempotencyKey: string): Promise<ActionResult<PaymentOutcome>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    parseOrThrow(z.uuid(), idempotencyKey);
    return simulateCardPurchase(await getEngineDeps(), user.id, input, idempotencyKey);
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function refreshTransactionStatusAction(transactionId: string): Promise<ActionResult<Transaction>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const id = parseOrThrow(z.string().min(1).max(64), transactionId);
    return refreshPendingTransaction(await getEngineDeps(), user.id, id);
  });
  if (result.ok) revalidateApp();
  return result;
}
