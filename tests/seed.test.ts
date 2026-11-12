import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/lib/analytics";
import { DEMO_INITIAL_BALANCE_KOBO } from "@/server/config";
import { buildDemoSeed } from "@/server/seed/demo-seed";
import { createTestBank, ledgerSum } from "./support/harness";

describe("demo seed", () => {
  const now = new Date("2026-11-12T10:30:00Z");
  const seed = buildDemoSeed({ userId: randomUUID(), email: "demo@eleos.test", fullName: "Tolu Adeyemi", phone: "08031234567", now });

  it("initialises the account at exactly ₦45,140,708.60", () => {
    expect(DEMO_INITIAL_BALANCE_KOBO).toBe(4_514_070_860);
    expect(seed.account.balance).toBe(4_514_070_860);
  });

  it("computes the opening entry so the ledger sums to the balance", () => {
    expect(ledgerSum(seed.ledgerEntries)).toBe(seed.account.balance);
    const opening = seed.ledgerEntries.filter((e) => e.entryType === "opening");
    expect(opening).toHaveLength(1);
    expect(opening[0]!.transactionId).toBeNull();
    // running balance never goes negative
    expect(Math.min(...seed.ledgerEntries.map((e) => e.balanceAfter))).toBeGreaterThan(0);
    // last entry's running balance is the account balance
    expect(seed.ledgerEntries.at(-1)!.balanceAfter).toBe(seed.account.balance);
  });

  it("contains realistic history including every status and no future dates", () => {
    expect(seed.transactions.length).toBeGreaterThan(60);
    const statuses = new Set(seed.transactions.map((t) => t.status));
    expect(statuses).toEqual(new Set(["successful", "failed", "reversed", "pending"]));
    const types = new Set(seed.transactions.map((t) => t.type));
    for (const type of ["transfer", "airtime", "data", "electricity", "cable_tv", "internet", "betting", "card", "credit"]) {
      expect(types.has(type as never), type).toBe(true);
    }
    expect(seed.transactions.every((t) => new Date(t.createdAt) <= now)).toBe(true);
    expect(new Set(seed.transactions.map((t) => t.reference)).size).toBe(seed.transactions.length);
    expect(seed.transactions.every((t) => t.isDemo)).toBe(true);
  });

  it("transaction effects reconcile with the ledger", () => {
    const opening = seed.ledgerEntries.find((e) => e.entryType === "opening")!.amount;
    const net = seed.transactions.reduce((sum, t) => {
      if (t.status === "failed" || t.status === "reversed") return sum;
      return t.direction === "credit" ? sum + t.amount : sum - t.total;
    }, 0);
    expect(opening + net).toBe(seed.account.balance);
  });

  it("produces analytics from the seeded data", () => {
    const analytics = computeAnalytics(seed.transactions, now);
    expect(analytics.totalReceived).toBeGreaterThan(0);
    expect(analytics.totalSpent).toBeGreaterThan(0);
    expect(analytics.monthly).toHaveLength(6);
    expect(analytics.categories.some((c) => c.amount > 0)).toBe(true);
    expect(analytics.pendingCount).toBe(1);
  });

  it("does not reset an existing account when provisioning runs again", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = await repo.getAccount(alice.id);
    await repo.ensureProvisioned(alice); // e.g. dashboard reload
    const after = await repo.getAccount(alice.id);
    expect(after!.id).toBe(before!.id);
    expect(after!.balance).toBe(before!.balance);
    expect(deps).toBeDefined();
  });
});
