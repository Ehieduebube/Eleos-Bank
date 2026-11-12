import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig, getSupabaseServiceKey } from "../config";
import { Errors } from "../errors";

/** User-scoped client: carries the signed-in user's JWT, so RLS applies. */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const config = getSupabaseConfig();
  if (!config) throw Errors.notConfigured("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}

/**
 * Service-role client for ledger RPCs, provisioning and PIN storage.
 * SERVER ONLY — the key bypasses RLS and must never reach the browser.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const config = getSupabaseConfig();
  const serviceKey = getSupabaseServiceKey();
  if (!config) throw Errors.notConfigured("Supabase is not configured.");
  if (!serviceKey) {
    throw Errors.notConfigured(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required on the server to post ledger transactions in Supabase mode.",
    );
  }
  return createClient(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
