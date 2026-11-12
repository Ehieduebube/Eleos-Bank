import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDataMode } from "../config";
import { createSupabaseServerClient } from "../supabase/clients";
import { getLocalSessionUser } from "./local-auth";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  /** The shared passwordless demo profile (local) or an anonymous demo session (Supabase). */
  isDemoUser: boolean;
}

/**
 * Resolve the signed-in user from the request, verified on the server.
 * (Supabase: `auth.getUser()` validates the JWT with the Auth server.)
 * Deduplicated per request with React `cache`.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (getDataMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const user = data.user;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const isAnonymous = user.is_anonymous === true;
    return {
      id: user.id,
      email: user.email || `guest-${user.id.slice(0, 8)}@demo.eleos.test`,
      fullName: typeof meta.full_name === "string" && meta.full_name ? meta.full_name : isAnonymous ? "Demo Explorer" : (user.email?.split("@")[0] ?? "Eleos customer"),
      phone: null,
      isDemoUser: isAnonymous || meta.demo === true,
    };
  }
  return getLocalSessionUser();
});

/** For pages and layouts: redirect to sign-in when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
