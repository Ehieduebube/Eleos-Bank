import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime, lagosDayKey, maskAccountNumber, maskPhone } from "@/lib/format";
import { parseTransactionQuery, lagosDayStartIso } from "@/server/repository/query";
import { seedToJson, toTransaction } from "@/server/repository/supabase-mapping";
import { buildDemoSeed } from "@/server/seed/demo-seed";

describe("Lagos date formatting (WAT, UTC+1)", () => {
  it("formats in West Africa Time regardless of the host time zone", () => {
    expect(formatDate("2026-11-12T08:30:00Z")).toBe("12 Nov 2026");
    expect(formatTime("2026-11-12T08:30:00Z")).toBe("9:30 AM");
    expect(formatTime("2026-11-12T11:05:00Z")).toBe("12:05 PM");
    expect(formatTime("2026-11-11T23:15:00Z")).toBe("12:15 AM");
    expect(formatDateTime("2026-11-12T19:00:00Z")).toBe("12 Nov 2026, 8:00 PM");
  });

  it("assigns late-UTC instants to the next Lagos day", () => {
    expect(lagosDayKey("2026-11-11T23:30:00Z")).toBe("2026-11-12");
    expect(lagosDayKey("2026-11-11T22:59:59Z")).toBe("2026-11-11");
    expect(lagosDayStartIso("2026-11-12")).toBe("2026-11-11T23:00:00.000Z");
  });

  it("masks sensitive identifiers", () => {
    expect(maskAccountNumber("0214587793")).toBe("••••••7793");
    expect(maskPhone("08031234567")).toBe("0803 *** 4567");
  });
});

describe("transaction query parsing", () => {
  it("accepts known filters and drops unsafe values", () => {
    const q = parseTransactionQuery({ q: "  lunch ", type: "transfer", status: "failed", from: "2026-11-01", to: "not-a-date", sort: "amount_desc", page: "3" });
    expect(q).toMatchObject({ search: "lunch", type: "transfer", status: "failed", from: "2026-11-01", to: undefined, sort: "amount_desc", page: 3 });
    const bad = parseTransactionQuery({ type: "drop table", status: "x", sort: "evil", page: "-4" });
    expect(bad).toMatchObject({ type: "all", status: "all", sort: "date_desc", page: 1 });
  });
});

describe("Supabase row mapping", () => {
  it("serialises the demo seed to snake_case rows that map back losslessly", () => {
    const seed = buildDemoSeed({ userId: randomUUID(), email: "demo@eleos.test", fullName: "Tolu Adeyemi", phone: "08031234567", now: new Date("2026-11-12T10:00:00Z") });
    const json = seedToJson(seed);
    expect(json.account.balance).toBe(4_514_070_860);
    expect(json.transactions).toHaveLength(seed.transactions.length);
    expect(json.ledger_entries).toHaveLength(seed.ledgerEntries.length);
    // `total` is a generated column in Postgres and must not be sent.
    expect(json.transactions.every((t) => !("total" in t))).toBe(true);

    const original = seed.transactions.find((t) => t.fee > 0)!;
    const row = json.transactions.find((t) => t.id === original.id)!;
    const roundTrip = toTransaction({ ...row, user_id: original.userId, idempotency_key: null, is_demo: true });
    expect(roundTrip).toEqual({ ...original, idempotencyKey: null });
  });
});
