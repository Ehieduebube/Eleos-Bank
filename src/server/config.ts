/**
 * Runtime configuration, derived from environment variables.
 *
 * Data mode:
 *   - "supabase": NEXT_PUBLIC_SUPABASE_URL and a publishable/anon key are set.
 *   - "local":    otherwise. A file-backed demo store on the server is used and
 *                 the UI says so explicitly; nothing pretends Supabase is connected.
 *
 * Payments mode is always "demo" unless PAYMENTS_MODE=live is set deliberately,
 * and even then a live adapter must be implemented and verified (see README).
 */

export type DataMode = "local" | "supabase";
export type PaymentsMode = "demo" | "live";

/** The simulated opening balance every demo account is initialised with: ₦45,140,708.60 */
export const DEMO_INITIAL_BALANCE_KOBO = 4_514_070_860;

/** The seeded primary demo user. The .test TLD is reserved and never routable. */
export const DEMO_USER = {
  email: "demo@eleos.test",
  fullName: "Tolu Adeyemi",
  phone: "08031234567",
} as const;

export const DEMO_BANK_NAME = "Eleos";

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getDataMode(): DataMode {
  if (process.env.ELEOS_DATA_MODE === "local") return "local";
  return getSupabaseConfig() ? "supabase" : "local";
}

/** Server-only secret used for ledger RPCs; never exposed to the browser. */
export function getSupabaseServiceKey(): string | null {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)?.trim() || null;
}

export function getPaymentsMode(): PaymentsMode {
  return process.env.PAYMENTS_MODE === "live" ? "live" : "demo";
}

/** One-click demo access. On by default; set DEMO_ACCESS_ENABLED=false to hide it. */
export function isDemoAccessEnabled(): boolean {
  return process.env.DEMO_ACCESS_ENABLED !== "false";
}

export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface RuntimeInfo {
  dataMode: DataMode;
  paymentsMode: PaymentsMode;
  /** True when running the local store on an ephemeral filesystem (e.g. Vercel without Supabase). */
  ephemeralStorage: boolean;
  supabaseServiceKeyConfigured: boolean;
}

export function getRuntimeInfo(): RuntimeInfo {
  const dataMode = getDataMode();
  return {
    dataMode,
    paymentsMode: getPaymentsMode(),
    ephemeralStorage: dataMode === "local" && !!process.env.VERCEL,
    supabaseServiceKeyConfigured: !!getSupabaseServiceKey(),
  };
}
