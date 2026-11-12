/**
 * Centralised money handling.
 *
 * Every amount in the system is an integer number of **kobo** (1 NGN = 100 kobo).
 * Floats are never used for stored or computed money; they only appear when a
 * value is handed to a chart library for plotting.
 */

export const KOBO_PER_NAIRA = 100;
export const CURRENCY = "NGN" as const;
export const NAIRA_SYMBOL = "₦"; // ₦

/** Largest amount we ever accept from input: ₦1 trillion, far above any limit. */
const MAX_INPUT_KOBO = 100_000_000_000_000;

const AMOUNT_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

/**
 * Parse a user-typed naira amount ("45,000", "1500.5", "₦ 2,000.00") into kobo.
 * Returns `null` for anything that is not a well-formed, non-negative amount
 * with at most two decimal places.
 */
export function parseNairaToKobo(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = typeof input === "number" ? input.toString() : input;
  const cleaned = raw.replace(/[\s,]/g, "").replace(NAIRA_SYMBOL, "").replace(/^NGN/i, "");
  if (!AMOUNT_PATTERN.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const kobo = Number(whole) * KOBO_PER_NAIRA + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kobo) || kobo > MAX_INPUT_KOBO) return null;
  return kobo;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * KOBO_PER_NAIRA);
}

export function koboToNaira(kobo: number): number {
  return kobo / KOBO_PER_NAIRA;
}

export function isValidKobo(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface FormatOptions {
  /** Prefix with + for positive values (used for credits). */
  signed?: boolean;
  /** Omit the kobo part when it is zero, e.g. ₦5,000 instead of ₦5,000.00. */
  trimZeroKobo?: boolean;
  /** Omit the ₦ symbol. */
  symbol?: boolean;
}

/**
 * Format kobo as naira, e.g. 4514070860 -> "₦45,140,708.60".
 * Integer arithmetic only, so the output is exact for every safe integer.
 */
export function formatNaira(kobo: number, options: FormatOptions = {}): string {
  const { signed = false, trimZeroKobo = false, symbol = true } = options;
  const negative = kobo < 0;
  const abs = Math.abs(Math.trunc(kobo));
  const whole = Math.floor(abs / KOBO_PER_NAIRA);
  const fraction = abs % KOBO_PER_NAIRA;
  const fractionPart = trimZeroKobo && fraction === 0 ? "" : `.${fraction.toString().padStart(2, "0")}`;
  const body = `${symbol ? NAIRA_SYMBOL : ""}${groupThousands(whole.toString())}${fractionPart}`;
  if (negative) return `-${body}`;
  if (signed && abs > 0) return `+${body}`;
  return body;
}

/** Compact form for chart axes and tight tiles: ₦45.1M, ₦850K, ₦1,200. */
export function formatNairaCompact(kobo: number): string {
  const naira = Math.abs(kobo) / KOBO_PER_NAIRA;
  const sign = kobo < 0 ? "-" : "";
  const fmt = (n: number, suffix: string) => {
    const rounded = n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
    return `${sign}${NAIRA_SYMBOL}${rounded}${suffix}`;
  };
  if (naira >= 1_000_000_000) return fmt(naira / 1_000_000_000, "B");
  if (naira >= 1_000_000) return fmt(naira / 1_000_000, "M");
  if (naira >= 10_000) return fmt(naira / 1_000, "K");
  return `${sign}${NAIRA_SYMBOL}${groupThousands(Math.round(naira).toString())}`;
}

/** Format a kobo value back into the plain editable string used by amount inputs. */
export function koboToInputString(kobo: number): string {
  const whole = Math.floor(kobo / KOBO_PER_NAIRA);
  const fraction = kobo % KOBO_PER_NAIRA;
  return fraction === 0 ? whole.toString() : `${whole}.${fraction.toString().padStart(2, "0")}`;
}

/**
 * Live-format what the user is typing in an amount field: keeps digits and one
 * decimal point, limits to 2 decimals and adds thousands separators.
 */
export function formatAmountTyping(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const [rawWhole, fraction] = cleaned.split(".");
  const whole = (rawWhole ?? "").replace(/^0+(?=\d)/, "").slice(0, 13);
  const grouped = groupThousands(whole);
  if (fraction === undefined) return grouped;
  return `${grouped || "0"}.${fraction.slice(0, 2)}`;
}
