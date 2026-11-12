import { describe, expect, it } from "vitest";
import { formatAmountTyping, formatNaira, formatNairaCompact, parseNairaToKobo } from "@/lib/money";
import { transferFee } from "@/lib/fees";
import { airtimeSchema, transferSchema } from "@/lib/validation";

describe("money formatting", () => {
  it("formats the demo opening balance exactly", () => {
    expect(formatNaira(4_514_070_860)).toBe("₦45,140,708.60");
  });

  it("formats signs, zero kobo and compact values", () => {
    expect(formatNaira(-150_000)).toBe("-₦1,500.00");
    expect(formatNaira(150_000, { signed: true })).toBe("+₦1,500.00");
    expect(formatNaira(500_000, { trimZeroKobo: true })).toBe("₦5,000");
    expect(formatNairaCompact(4_514_070_860)).toBe("₦45.1M");
    expect(formatNairaCompact(85_000_000)).toBe("₦850K");
  });

  it("formats while typing", () => {
    expect(formatAmountTyping("1234567")).toBe("1,234,567");
    expect(formatAmountTyping("1234.567")).toBe("1,234.56");
    expect(formatAmountTyping("00012")).toBe("12");
    expect(formatAmountTyping("abc")).toBe("");
  });
});

describe("amount parsing", () => {
  it("parses valid naira strings to integer kobo", () => {
    expect(parseNairaToKobo("45,140,708.60")).toBe(4_514_070_860);
    expect(parseNairaToKobo("₦1,500")).toBe(150_000);
    expect(parseNairaToKobo("0.1")).toBe(10);
    expect(parseNairaToKobo("19.99")).toBe(1_999);
  });

  it("rejects negative, malformed and over-precise amounts", () => {
    for (const bad of ["-100", "1.234", "abc", "", "1e5", "12..5", "NaN", "Infinity"]) {
      expect(parseNairaToKobo(bad), bad).toBeNull();
    }
  });
});

describe("validation schemas", () => {
  const base = { bankCode: "058", accountNumber: "0214587793", narration: "", saveBeneficiary: false, nickname: "" };

  it("rejects invalid transfer amounts with clear messages", () => {
    const cases: Array<[string, RegExp]> = [
      ["", /enter an amount/i],
      ["-500", /negative/i],
      ["0", /greater than zero/i],
      ["50", /minimum/i],
      ["12.345", /valid naira amount/i],
      ["20000000", /maximum/i],
    ];
    for (const [amount, message] of cases) {
      const result = transferSchema.safeParse({ ...base, amount });
      expect(result.success, amount).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(message);
    }
  });

  it("validates NUBAN and bank code", () => {
    expect(transferSchema.safeParse({ ...base, amount: "1000", accountNumber: "12345" }).success).toBe(false);
    expect(transferSchema.safeParse({ ...base, amount: "1000", bankCode: "999" }).success).toBe(false);
    expect(transferSchema.safeParse({ ...base, amount: "1000" }).success).toBe(true);
  });

  it("normalises Nigerian phone numbers", () => {
    const parsed = airtimeSchema.parse({ network: "mtn", phone: "+234 803 123 4567", amount: "500" });
    expect(parsed.phone).toBe("08031234567");
    expect(airtimeSchema.safeParse({ network: "mtn", phone: "0603123456", amount: "500" }).success).toBe(false);
  });

  it("applies the tiered transfer fee", () => {
    expect(transferFee(500_000)).toBe(1_000);
    expect(transferFee(500_001)).toBe(2_500);
    expect(transferFee(5_000_000)).toBe(2_500);
    expect(transferFee(5_000_001)).toBe(5_000);
  });
});
