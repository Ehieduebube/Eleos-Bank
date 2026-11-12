import type { TransactionType } from "./types";

/**
 * Demo fee schedule and per-transaction limits (all kobo).
 *
 * The server is the only place fees are *charged*: the client may display a
 * preview from these same functions, but every quote and execution recomputes
 * the fee on the server and never accepts a fee from the browser.
 */

const n = (naira: number) => naira * 100;

export interface AmountLimits {
  min: number;
  max: number;
}

export const LIMITS: Record<"transfer" | "airtime" | "electricity" | "utility" | "betting" | "credit" | "card", AmountLimits> = {
  transfer: { min: n(100), max: n(10_000_000) },
  airtime: { min: n(50), max: n(50_000) },
  electricity: { min: n(1_000), max: n(500_000) },
  utility: { min: n(500), max: n(1_000_000) },
  betting: { min: n(100), max: n(2_000_000) },
  credit: { min: n(100), max: n(5_000_000) },
  card: { min: n(100), max: n(2_000_000) },
};

/**
 * Interbank transfer fee tiers, modelled on the commonly published NIP tiers:
 * ₦10 up to ₦5,000; ₦25 up to ₦50,000; ₦50 above ₦50,000.
 */
export function transferFee(amount: number): number {
  if (amount <= n(5_000)) return n(10);
  if (amount <= n(50_000)) return n(25);
  return n(50);
}

export function feeFor(type: TransactionType, amount: number): number {
  switch (type) {
    case "transfer":
      return transferFee(amount);
    case "electricity":
      return n(100);
    case "utility":
      return n(50);
    default:
      return 0;
  }
}

export function describeFee(type: TransactionType): string {
  switch (type) {
    case "transfer":
      return "₦10 up to ₦5,000 · ₦25 up to ₦50,000 · ₦50 above";
    case "electricity":
      return "₦100 convenience fee";
    case "utility":
      return "₦50 convenience fee";
    default:
      return "No fee";
  }
}
