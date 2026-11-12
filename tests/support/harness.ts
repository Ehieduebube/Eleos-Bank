import { randomUUID } from "node:crypto";
import type { PaymentRequestInput } from "@/lib/validation";
import type { EngineDeps } from "@/server/engine/payments";
import { LocalStore } from "@/server/local/store";
import { createDemoRegistry } from "@/server/providers/demo";
import { LocalBankRepository } from "@/server/repository/local";

/** An isolated, in-memory bank with two provisioned users. */
export async function createTestBank(now = new Date()) {
  const store = new LocalStore(null);
  const repo = new LocalBankRepository(store);
  const providers = createDemoRegistry({ latencyMs: 0, now: () => now.getTime() });
  const deps: EngineDeps = { repo, providers };

  const alice = { id: randomUUID(), email: "alice@example.test", fullName: "Alice Okeke", phone: "08031112222" };
  const bob = { id: randomUUID(), email: "bob@example.test", fullName: "Bob Danjuma", phone: "08051113333" };
  await repo.ensureProvisioned(alice);
  await repo.ensureProvisioned(bob);

  return { store, repo, providers, deps, alice, bob };
}

export function transferRequest(overrides: Partial<{ bankCode: string; accountNumber: string; amount: string; narration: string; saveBeneficiary: boolean; nickname: string }> = {}): PaymentRequestInput {
  return {
    kind: "transfer",
    input: {
      bankCode: "058",
      accountNumber: "0214587793",
      amount: "25000",
      narration: "Lunch",
      saveBeneficiary: false,
      nickname: "",
      ...overrides,
    },
  };
}

export function envelope(confirmedTotal: number, extra: Partial<{ idempotencyKey: string; pin: string }> = {}) {
  return { idempotencyKey: randomUUID(), confirmedTotal, ...extra };
}

export function ledgerSum(entries: { direction: "debit" | "credit"; amount: number }[]): number {
  return entries.reduce((sum, e) => sum + (e.direction === "credit" ? e.amount : -e.amount), 0);
}
