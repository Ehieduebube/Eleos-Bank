import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashSecret } from "@/server/auth/crypto";
import { AppError } from "@/server/errors";
import { executePayment, postDemoCredit, refreshPendingTransaction, simulateCardPurchase } from "@/server/engine/payments";
import { createDemoRegistry, DEMO_PENDING_SETTLE_MS } from "@/server/providers/demo";
import { createTestBank, envelope, ledgerSum, transferRequest } from "./support/harness";

const TRANSFER_25K_TOTAL = 2_500_000 + 2_500; // ₦25,000 + ₦25 fee

async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}

describe("transfers", () => {
  it("deducts amount + fee exactly once and records the transaction", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    expect(before).toBe(4_514_070_860);

    const result = await executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL));

    expect(result.replayed).toBe(false);
    expect(result.transaction.status).toBe("successful");
    expect(result.transaction.amount).toBe(2_500_000);
    expect(result.transaction.fee).toBe(2_500);
    expect(result.transaction.reference).toMatch(/^ELS-\d{6}-[A-Z2-9]{10}$/);
    expect(result.transaction.details.recipientName).toBe("AMAKA CHIOMA OBI");
    expect(result.balance).toBe(before - TRANSFER_25K_TOTAL);
    expect((await repo.getAccount(alice.id))!.balance).toBe(before - TRANSFER_25K_TOTAL);

    const stored = await repo.getTransaction(alice.id, result.transaction.reference);
    expect(stored?.id).toBe(result.transaction.id);
  });

  it("rejects payments larger than the available balance without touching it", async () => {
    const { repo, deps, alice } = await createTestBank();
    // Drain to ~₦5.1M with four ₦10M transfers (the per-transfer maximum).
    for (let i = 0; i < 4; i++) {
      await executePayment(deps, alice.id, transferRequest({ amount: "10000000" }), envelope(1_000_000_000 + 5_000));
    }
    const before = (await repo.getAccount(alice.id))!.balance;
    const txCountBefore = (await repo.listRecentTransactions(alice.id)).length;
    expect(before).toBeLessThan(600_000_000);

    await expectAppError(
      executePayment(deps, alice.id, transferRequest({ amount: "6000000" }), envelope(600_000_000 + 5_000)),
      "INSUFFICIENT_FUNDS",
    );
    expect((await repo.getAccount(alice.id))!.balance).toBe(before);
    expect((await repo.listRecentTransactions(alice.id)).length).toBe(txCountBefore);
  });

  it("rejects invalid amounts on the server", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    for (const amount of ["-500", "0", "abc", "12.345", "50", ""]) {
      const error = await expectAppError(executePayment(deps, alice.id, transferRequest({ amount }), envelope(0)), "VALIDATION");
      expect(error.fieldErrors?.amount, amount).toBeTruthy();
    }
    expect((await repo.getAccount(alice.id))!.balance).toBe(before);
  });

  it("never trusts a client total: refuses when the confirmed total differs from the server quote", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    await expectAppError(executePayment(deps, alice.id, transferRequest(), envelope(2_500_000)), "QUOTE_CHANGED");
    expect((await repo.getAccount(alice.id))!.balance).toBe(before);
  });

  it("is idempotent for duplicate submissions, including concurrent double-clicks", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    const env = envelope(TRANSFER_25K_TOTAL);

    const [first, second] = await Promise.all([
      executePayment(deps, alice.id, transferRequest(), env),
      executePayment(deps, alice.id, transferRequest(), env),
    ]);
    const third = await executePayment(deps, alice.id, transferRequest(), env);

    expect(first.transaction.id).toBe(second.transaction.id);
    expect(third.transaction.id).toBe(first.transaction.id);
    expect([first.replayed, second.replayed].filter(Boolean)).toHaveLength(1);
    expect(third.replayed).toBe(true);
    expect((await repo.getAccount(alice.id))!.balance).toBe(before - TRANSFER_25K_TOTAL);

    const sameKey = (await repo.listRecentTransactions(alice.id)).filter((t) => t.idempotencyKey === env.idempotencyKey);
    expect(sameKey).toHaveLength(1);
  });

  it("refuses to reuse a submission key for a different payment", async () => {
    const { deps, alice } = await createTestBank();
    const env = envelope(TRANSFER_25K_TOTAL);
    await executePayment(deps, alice.id, transferRequest(), env);
    await expectAppError(
      executePayment(deps, alice.id, transferRequest({ amount: "30000" }), { ...env, confirmedTotal: 3_000_000 + 2_500 }),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("reverses funds automatically when the provider declines", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    const result = await executePayment(deps, alice.id, transferRequest({ accountNumber: "1234560000" }), envelope(TRANSFER_25K_TOTAL));

    expect(result.transaction.status).toBe("failed");
    expect(result.transaction.failureReason).toMatch(/money has been returned/i);
    expect(result.balance).toBe(before);

    const entries = (await repo.listLedgerEntries(alice.id)).filter((e) => e.transactionId === result.transaction.id);
    expect(entries.map((e) => e.entryType).sort()).toEqual(["fee", "principal", "reversal"]);
    expect(ledgerSum(entries)).toBe(0);
  });

  it("fails verification for unknown accounts before any debit", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    await expectAppError(executePayment(deps, alice.id, transferRequest({ accountNumber: "0000000000" }), envelope(TRANSFER_25K_TOTAL)), "VERIFICATION_FAILED");
    expect((await repo.getAccount(alice.id))!.balance).toBe(before);
  });

  it("keeps pending payments debited and settles them on requery", async () => {
    const start = new Date();
    const bank = await createTestBank(start);
    const { repo, alice } = bank;
    const before = (await repo.getAccount(alice.id))!.balance;
    const result = await executePayment(bank.deps, alice.id, transferRequest({ accountNumber: "1234569999" }), envelope(TRANSFER_25K_TOTAL));
    expect(result.transaction.status).toBe("pending");
    expect(result.balance).toBe(before - TRANSFER_25K_TOTAL);

    // Too early: still pending.
    expect((await refreshPendingTransaction(bank.deps, alice.id, result.transaction.id)).status).toBe("pending");

    // Later: provider confirms.
    const later = { repo, providers: createDemoRegistry({ now: () => Date.now() + DEMO_PENDING_SETTLE_MS + 1_000 }) };
    const settled = await refreshPendingTransaction(later, alice.id, result.transaction.id);
    expect(settled.status).toBe("successful");
    expect((await repo.getAccount(alice.id))!.balance).toBe(before - TRANSFER_25K_TOTAL);
  });

  it("saves the beneficiary when asked", async () => {
    const { repo, deps, alice } = await createTestBank();
    await executePayment(deps, alice.id, transferRequest({ bankCode: "070", accountNumber: "6311204578", saveBeneficiary: true, nickname: "Kelechi" }), envelope(TRANSFER_25K_TOTAL));
    const saved = await repo.findBeneficiary(alice.id, "070", "6311204578");
    expect(saved?.accountName).toBe("KELECHI DAVID OKAFOR");
    expect(saved?.nickname).toBe("Kelechi");
  });
});

describe("transaction PIN", () => {
  it("requires, verifies and locks the PIN", async () => {
    const { repo, deps, alice } = await createTestBank();
    await repo.setPinHash(alice.id, await hashSecret("2580"));
    await expectAppError(executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL)), "PIN_REQUIRED");
    await expectAppError(executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL, { pin: "1111" })), "PIN_INVALID");
    const ok = await executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL, { pin: "2580" }));
    expect(ok.transaction.status).toBe("successful");

    for (let i = 0; i < 4; i++) {
      await expectAppError(executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL, { pin: "0001" })), "PIN_INVALID");
    }
    await expectAppError(executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL, { pin: "0001" })), "PIN_LOCKED");
    await expectAppError(executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL, { pin: "2580" })), "PIN_LOCKED");
  });
});

describe("bills, airtime, data, betting", () => {
  it("prices plan-based products from the server catalogue", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    const result = await executePayment(
      deps,
      alice.id,
      { kind: "data", input: { network: "mtn", phone: "08031234567", bundleId: "mtn-7gb-30d" } },
      envelope(350_000),
    );
    expect(result.transaction.amount).toBe(350_000);
    expect(result.balance).toBe(before - 350_000);
  });

  it("issues a simulated token for prepaid electricity and charges the convenience fee", async () => {
    const { deps, alice } = await createTestBank();
    const result = await executePayment(
      deps,
      alice.id,
      { kind: "electricity", input: { discoId: "ikedc", meterType: "prepaid", meterNumber: "45071234567", amount: "5000" } },
      envelope(500_000 + 10_000),
    );
    expect(result.transaction.status).toBe("successful");
    expect(result.transaction.fee).toBe(10_000);
    expect(result.transaction.details.token).toMatch(/^\d{4}(-\d{4}){4}$/);
  });

  it("funds a betting wallet and records airtime purchases", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    await executePayment(deps, alice.id, { kind: "betting", input: { providerId: "sportybet", customerId: "TOLU2045", amount: "2000" } }, envelope(200_000));
    await executePayment(deps, alice.id, { kind: "airtime", input: { network: "mtn", phone: "08031234567", amount: "1000" } }, envelope(100_000));
    expect((await repo.getAccount(alice.id))!.balance).toBe(before - 300_000);
  });
});

describe("credits and card", () => {
  it("adds simulated credits to the balance", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    const result = await postDemoCredit(deps, alice.id, { amount: "150000", source: "refund" }, randomUUID());
    expect(result.transaction.direction).toBe("credit");
    expect(result.transaction.status).toBe("successful");
    expect(result.balance).toBe(before + 15_000_000);
  });

  it("declines card purchases while frozen or over the limit, without moving money", async () => {
    const { repo, deps, alice } = await createTestBank();
    const before = (await repo.getAccount(alice.id))!.balance;
    await repo.updateCard(alice.id, { frozen: true });
    const frozen = await simulateCardPurchase(deps, alice.id, { merchantId: "netflix", amount: "7000" }, randomUUID());
    expect(frozen.transaction.status).toBe("failed");
    expect(frozen.transaction.failureReason).toMatch(/frozen/);

    await repo.updateCard(alice.id, { frozen: false, dailyLimit: 1_000_000 });
    const over = await simulateCardPurchase(deps, alice.id, { merchantId: "jumia", amount: "15000" }, randomUUID());
    expect(over.transaction.failureReason).toMatch(/daily card limit/);
    expect((await repo.getAccount(alice.id))!.balance).toBe(before);

    const ok = await simulateCardPurchase(deps, alice.id, { merchantId: "spotify", amount: "1900" }, randomUUID());
    expect(ok.transaction.status).toBe("successful");
    expect((await repo.getAccount(alice.id))!.balance).toBe(before - 190_000);
  });
});

describe("balance and ledger consistency", () => {
  it("keeps balance === sum(ledger) === opening + transaction effects after mixed activity", async () => {
    const { repo, deps, alice } = await createTestBank();
    await executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL));
    await executePayment(deps, alice.id, transferRequest({ accountNumber: "1234560000" }), envelope(TRANSFER_25K_TOTAL));
    await executePayment(deps, alice.id, transferRequest({ accountNumber: "1234569999" }), envelope(TRANSFER_25K_TOTAL));
    await postDemoCredit(deps, alice.id, { amount: "5000", source: "topup" }, randomUUID());
    await simulateCardPurchase(deps, alice.id, { merchantId: "bolt", amount: "3500" }, randomUUID());

    const account = (await repo.getAccount(alice.id))!;
    const entries = await repo.listLedgerEntries(alice.id);
    expect(ledgerSum(entries)).toBe(account.balance);

    const opening = entries.find((e) => e.entryType === "opening")!.amount;
    const txns = await repo.listRecentTransactions(alice.id);
    const effect = txns.reduce((sum, t) => {
      if (t.status === "failed" || t.status === "reversed") return sum;
      return t.direction === "credit" ? sum + t.amount : sum - t.total;
    }, 0);
    expect(opening + effect).toBe(account.balance);
  });
});

describe("user data isolation", () => {
  it("prevents one user from reading or modifying another user's records", async () => {
    const { repo, deps, alice, bob } = await createTestBank();
    const aliceTxn = await executePayment(deps, alice.id, transferRequest(), envelope(TRANSFER_25K_TOTAL));
    const aliceBeneficiary = (await repo.listBeneficiaries(alice.id))[0]!;
    const bobBefore = (await repo.getAccount(bob.id))!.balance;

    expect(await repo.getTransaction(bob.id, aliceTxn.transaction.id)).toBeNull();
    expect(await repo.getTransaction(bob.id, aliceTxn.transaction.reference)).toBeNull();
    expect(await repo.getBeneficiary(bob.id, aliceBeneficiary.id)).toBeNull();
    const bobTxns = await repo.listRecentTransactions(bob.id);
    expect(bobTxns.some((t) => t.userId !== bob.id)).toBe(false);

    await expectAppError(repo.deleteBeneficiary(bob.id, aliceBeneficiary.id), "NOT_FOUND");
    await expectAppError(
      repo.updateBeneficiary(bob.id, aliceBeneficiary.id, { ...aliceBeneficiary, nickname: "hijacked" }),
      "NOT_FOUND",
    );
    await expectAppError(repo.settleTransaction(bob.id, aliceTxn.transaction.id, { status: "failed" }), "NOT_FOUND");
    await expectAppError(refreshPendingTransaction(deps, bob.id, aliceTxn.transaction.id), "NOT_FOUND");
    expect((await repo.getBeneficiary(alice.id, aliceBeneficiary.id))?.nickname).toBe(aliceBeneficiary.nickname);

    // The same idempotency key used by another user is an independent submission.
    const shared = envelope(TRANSFER_25K_TOTAL);
    const a = await executePayment(deps, alice.id, transferRequest(), shared);
    const b = await executePayment(deps, bob.id, transferRequest(), shared);
    expect(a.transaction.id).not.toBe(b.transaction.id);
    expect(b.replayed).toBe(false);
    expect((await repo.getAccount(bob.id))!.balance).toBe(bobBefore - TRANSFER_25K_TOTAL);
  });
});
