import type { TransactionDetails, TransactionType } from "@/lib/types";

/**
 * Provider adapter contracts. The money engine only talks to these interfaces,
 * so a live integration (e.g. Paystack for transfers/verification, Flutterwave
 * for bills) can be added as a new adapter without touching the engine or UI.
 *
 * Contract rules for every adapter:
 *  - Never throw for a business decline: return { status: "failed", failureReason }.
 *  - Throw only for "unknown outcome" situations (timeouts, 5xx). The engine then
 *    leaves the transaction PENDING for requery/reconciliation instead of guessing.
 *  - `reference` is our unique transaction reference; pass it to the provider as
 *    the idempotency/merchant reference so retries cannot double-pay.
 */

export interface ProviderOutcome {
  status: "successful" | "failed" | "pending";
  providerReference: string | null;
  failureReason?: string;
  details?: TransactionDetails;
}

export type LookupResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

export interface RequeryInput {
  reference: string;
  providerReference: string | null;
  type: TransactionType;
  amount: number;
  createdAt: string;
  details: TransactionDetails;
}

export interface AccountVerificationProvider {
  readonly name: string;
  resolveAccount(input: { bankCode: string; accountNumber: string }): Promise<LookupResult<{ accountName: string }>>;
}

export interface TransferProvider {
  readonly name: string;
  sendTransfer(input: {
    reference: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    narration: string | null;
  }): Promise<ProviderOutcome>;
  requery(input: RequeryInput): Promise<ProviderOutcome>;
}

export interface TelcoProvider {
  readonly name: string;
  purchaseAirtime(input: { reference: string; network: string; phone: string; amount: number }): Promise<ProviderOutcome>;
  purchaseData(input: { reference: string; network: string; phone: string; bundleId: string; amount: number }): Promise<ProviderOutcome>;
  requery(input: RequeryInput): Promise<ProviderOutcome>;
}

export type BillService = "electricity" | "cable_tv" | "internet" | "utility";

export interface BillsProvider {
  readonly name: string;
  verifyCustomer(input: { service: BillService; billerId: string; customerId: string; meterType?: "prepaid" | "postpaid" }): Promise<
    LookupResult<{ customerName: string; address?: string }>
  >;
  payBill(input: {
    reference: string;
    service: BillService;
    billerId: string;
    customerId: string;
    amount: number;
    planId?: string;
    meterType?: "prepaid" | "postpaid";
  }): Promise<ProviderOutcome>;
  requery(input: RequeryInput): Promise<ProviderOutcome>;
}

export interface BettingFundingProvider {
  readonly name: string;
  verifyCustomer(input: { providerId: string; customerId: string }): Promise<LookupResult<{ customerName: string }>>;
  fundWallet(input: { reference: string; providerId: string; customerId: string; amount: number }): Promise<ProviderOutcome>;
  requery(input: RequeryInput): Promise<ProviderOutcome>;
}

export interface ProviderRegistry {
  mode: "demo" | "live";
  verification: AccountVerificationProvider;
  transfers: TransferProvider;
  telco: TelcoProvider;
  bills: BillsProvider;
  betting: BettingFundingProvider;
}
