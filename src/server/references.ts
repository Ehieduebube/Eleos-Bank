import { randomBytes } from "node:crypto";
import { lagosDayKey } from "@/lib/format";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Unique transaction reference, e.g. ELS-261112-7KQ2M9XZPD. Uniqueness is also enforced by the store. */
export function generateReference(date: Date = new Date()): string {
  const day = lagosDayKey(date).replace(/-/g, "").slice(2);
  return `ELS-${day}-${randomCode(10)}`;
}

export function generateProviderReference(prefix: string): string {
  return `${prefix}-${randomCode(12)}`;
}
