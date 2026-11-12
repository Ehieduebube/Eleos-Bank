import "server-only";
import { cache } from "react";
import { getDataMode } from "./config";
import type { EngineDeps } from "./engine/payments";
import { getProviderRegistry } from "./providers";
import { getLocalStore, LocalBankRepository } from "./repository/local";
import { SupabaseBankRepository } from "./repository/supabase";
import type { BankRepository } from "./repository/types";
import { requireUser } from "./auth/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase/clients";

/** The repository for the current request (Supabase clients carry the request's cookies). */
export const getRepository = cache(async (): Promise<BankRepository> => {
  if (getDataMode() === "supabase") {
    return new SupabaseBankRepository(await createSupabaseServerClient(), createSupabaseAdminClient);
  }
  return new LocalBankRepository(getLocalStore());
});

export const getEngineDeps = cache(async (): Promise<EngineDeps> => ({
  repo: await getRepository(),
  providers: getProviderRegistry(),
}));

/**
 * Everything the app shell needs about the signed-in user. Provisions the demo
 * account on first access (idempotent — never resets an existing balance).
 */
export const getViewer = cache(async () => {
  const user = await requireUser();
  const repo = await getRepository();
  await repo.ensureProvisioned({ id: user.id, email: user.email, fullName: user.fullName, phone: user.phone });
  const [profile, account, preferences, security] = await Promise.all([
    repo.getProfile(user.id),
    repo.getAccount(user.id),
    repo.getPreferences(user.id),
    repo.getSecurityStatus(user.id),
  ]);
  if (!profile || !account || !preferences) throw new Error("Demo account provisioning did not complete.");
  return { user, repo, profile, account, preferences, security };
});

export type Viewer = Awaited<ReturnType<typeof getViewer>>;
