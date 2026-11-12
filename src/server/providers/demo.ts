import { createHash } from "node:crypto";
import { getDisco } from "@/lib/catalog/billers";
import { formatToken } from "@/lib/format";
import { generateProviderReference } from "../references";
import { DEMO_DIRECTORY, simulatedAccountName, simulatedCustomerName } from "./demo-directory";
import type {
  AccountVerificationProvider,
  BettingFundingProvider,
  BillService,
  BillsProvider,
  LookupResult,
  ProviderOutcome,
  ProviderRegistry,
  RequeryInput,
  TelcoProvider,
  TransferProvider,
} from "./types";

/**
 * DEMO provider — a deterministic simulator. It moves no money, contacts no
 * bank, telco, biller or betting operator, and every response it produces is
 * labelled as simulated in the UI.
 *
 * Test inputs (documented in the README and shown in the UI as "Demo tips"):
 *   - Account number 0000000000 or 1111111111  -> verification fails
 *   - Recipient identifier ending in 0000         -> provider declines (funds auto-reversed)
 *   - Recipient identifier ending in 9999         -> stays PENDING until re-queried (~20s)
 */

export const DEMO_PENDING_SETTLE_MS = 20_000;
const UNRESOLVABLE_ACCOUNTS = new Set(["0000000000", "1111111111"]);

function decide(identifier: string): "successful" | "failed" | "pending" {
  if (identifier.endsWith("0000")) return "failed";
  if (identifier.endsWith("9999")) return "pending";
  return "successful";
}

function simulatedToken(reference: string): string {
  const digest = createHash("sha256").update(`token:${reference}`).digest();
  let digits = "";
  for (const byte of digest) {
    digits += (byte % 10).toString();
    if (digits.length === 20) break;
  }
  return formatToken(digits);
}

function electricityDetails(reference: string, billerId: string, amount: number, meterType?: "prepaid" | "postpaid") {
  if (meterType !== "prepaid") return undefined;
  const tariff = getDisco(billerId)?.tariffPerKwh ?? 20_950;
  return { token: simulatedToken(reference), units: `${(amount / tariff).toFixed(1)} kWh` };
}

export interface DemoProviderOptions {
  /** Artificial latency so loading states are visible; 0 in tests. */
  latencyMs?: number;
  now?: () => number;
}

export class DemoProvider implements AccountVerificationProvider, TransferProvider, TelcoProvider, BillsProvider, BettingFundingProvider {
  readonly name = "demo";
  private readonly latencyMs: number;
  private readonly now: () => number;

  constructor(options: DemoProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.now = options.now ?? Date.now;
  }

  private async wait(factor = 1) {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs * factor));
  }

  private outcome(identifier: string, failureReason: string, details?: ProviderOutcome["details"]): ProviderOutcome {
    const decision = decide(identifier);
    if (decision === "failed") return { status: "failed", providerReference: generateProviderReference("PRV"), failureReason };
    if (decision === "pending") return { status: "pending", providerReference: generateProviderReference("PRV") };
    return { status: "successful", providerReference: generateProviderReference("PRV"), details };
  }

  // ---- verification ----

  async resolveAccount({ bankCode, accountNumber }: { bankCode: string; accountNumber: string }): Promise<LookupResult<{ accountName: string }>> {
    await this.wait();
    if (UNRESOLVABLE_ACCOUNTS.has(accountNumber)) {
      return { ok: false, reason: "We couldn't find an account with these details. Check the number and bank." };
    }
    const known = DEMO_DIRECTORY.find((d) => d.bankCode === bankCode && d.accountNumber === accountNumber);
    return { ok: true, accountName: known?.accountName ?? simulatedAccountName(bankCode, accountNumber) };
  }

  // ---- transfers ----

  async sendTransfer(input: { reference: string; accountNumber: string }): Promise<ProviderOutcome> {
    await this.wait(1.5);
    return this.outcome(input.accountNumber, "Beneficiary bank unavailable. Your money has been returned.");
  }

  // ---- telco ----

  async purchaseAirtime(input: { phone: string }): Promise<ProviderOutcome> {
    await this.wait(1.2);
    return this.outcome(input.phone, "Network operator declined the top-up. Your money has been returned.");
  }

  async purchaseData(input: { phone: string }): Promise<ProviderOutcome> {
    await this.wait(1.2);
    return this.outcome(input.phone, "Network operator declined the bundle. Your money has been returned.");
  }

  // ---- bills ----

  async verifyCustomer(input: { service?: BillService; billerId?: string; providerId?: string; customerId: string }): Promise<
    LookupResult<{ customerName: string; address?: string }>
  > {
    await this.wait();
    if (/^0+$/.test(input.customerId)) return { ok: false, reason: "Customer not found. Check the number and try again." };
    const seed = `${input.service ?? "betting"}:${input.billerId ?? input.providerId}:${input.customerId}`;
    const customerName = simulatedCustomerName(seed);
    const address = input.service === "electricity" ? `${(Number(input.customerId.slice(-2)) % 40) + 1} Demo Close, Lagos` : undefined;
    return { ok: true, customerName, ...(address ? { address } : {}) };
  }

  async payBill(input: { reference: string; service: BillService; billerId: string; customerId: string; amount: number; meterType?: "prepaid" | "postpaid" }): Promise<ProviderOutcome> {
    await this.wait(1.5);
    const details = input.service === "electricity" ? electricityDetails(input.reference, input.billerId, input.amount, input.meterType) : undefined;
    return this.outcome(input.customerId, "Biller is temporarily unavailable. Your money has been returned.", details);
  }

  // ---- betting ----

  async fundWallet(input: { customerId: string }): Promise<ProviderOutcome> {
    await this.wait(1.2);
    return this.outcome(input.customerId, "Betting operator could not credit this wallet. Your money has been returned.");
  }

  // ---- reconciliation ----

  async requery(input: RequeryInput): Promise<ProviderOutcome> {
    await this.wait(0.6);
    const age = this.now() - new Date(input.createdAt).getTime();
    if (age < DEMO_PENDING_SETTLE_MS) return { status: "pending", providerReference: input.providerReference };
    const details =
      input.type === "electricity" && input.details.providerId
        ? electricityDetails(input.reference, String(input.details.providerId), input.amount, (input.details.meterType as "prepaid" | "postpaid" | undefined) ?? "prepaid")
        : undefined;
    return { status: "successful", providerReference: input.providerReference ?? generateProviderReference("PRV"), details };
  }
}

export function createDemoRegistry(options: DemoProviderOptions = {}): ProviderRegistry {
  const demo = new DemoProvider(options);
  return { mode: "demo", verification: demo, transfers: demo, telco: demo, bills: demo, betting: demo };
}
