import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Secret hashing for the local demo store (passwords and transaction PINs).
 * scrypt with a random 16-byte salt per secret; encoded as
 *   scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>
 * Plaintext secrets are never stored or logged. (With Supabase, passwords are
 * handled by Supabase Auth; PIN hashes still use this module.)
 */

const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function scrypt(secret: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(secret, salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret.normalize("NFKC"), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifySecret(secret: string, encoded: string | null | undefined): Promise<boolean> {
  if (!encoded) return false;
  const [scheme, n, r, p, saltB64, hashB64] = encoded.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(secret.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
