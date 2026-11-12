"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/types";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation";
import { parseOrThrow, runAction, safeNextPath } from "@/server/action-utils";
import { signInLocal, signInLocalDemo, signOutLocal, signUpLocal } from "@/server/auth/local-auth";
import { getAppUrl, getDataMode, isDemoAccessEnabled } from "@/server/config";
import { AppError } from "@/server/errors";
import { createSupabaseServerClient } from "@/server/supabase/clients";

export async function signInAction(values: SignInInput, next?: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const input = parseOrThrow(signInSchema, values);
    if (getDataMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
      if (error) {
        const message = /confirm/i.test(error.message) ? "Please confirm your email address before signing in." : "Incorrect email or password.";
        throw new AppError("VALIDATION", message, { password: message });
      }
    } else {
      await signInLocal(input.email, input.password);
    }
    return null;
  });
  if (result.ok) redirect(safeNextPath(next));
  return result;
}

export async function signUpAction(values: SignUpInput): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const result = await runAction(async () => {
    const input = parseOrThrow(signUpSchema, values);
    if (getDataMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { full_name: input.fullName }, emailRedirectTo: `${getAppUrl()}/auth/callback?next=/overview` },
      });
      if (error) throw new AppError("VALIDATION", error.message, { email: error.message });
      return { needsEmailConfirmation: !data.session };
    }
    await signUpLocal({ fullName: input.fullName, email: input.email, password: input.password });
    return { needsEmailConfirmation: false };
  });
  if (result.ok && !result.data.needsEmailConfirmation) redirect("/overview");
  return result;
}

/**
 * One-click access to a simulated demo account.
 *  - Local mode: signs into the seeded passwordless demo profile.
 *  - Supabase mode: signs into DEMO_ACCOUNT_EMAIL/PASSWORD (server-only env vars,
 *    created by `npm run db:seed`) or, if those are unset, an anonymous session.
 * No credentials are hard-coded in the source.
 */
export async function enterDemoAction(): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    if (!isDemoAccessEnabled()) throw new AppError("FORBIDDEN", "Demo access is disabled on this deployment.");
    if (getDataMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const email = process.env.DEMO_ACCOUNT_EMAIL;
      const password = process.env.DEMO_ACCOUNT_PASSWORD;
      if (email && password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new AppError("NOT_CONFIGURED", "The configured demo account could not sign in. Run `npm run db:seed` to create it.");
      } else {
        const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: "Demo Explorer", demo: true } } });
        if (error) {
          throw new AppError(
            "NOT_CONFIGURED",
            "Demo access needs either anonymous sign-ins enabled in Supabase Auth, or DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD set on the server.",
          );
        }
      }
    } else {
      await signInLocalDemo();
    }
    return null;
  });
  if (result.ok) redirect("/overview");
  return result;
}

export async function signOutAction(): Promise<void> {
  if (getDataMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  } else {
    await signOutLocal();
  }
  redirect("/sign-in");
}

export async function forgotPasswordAction(values: ForgotPasswordInput): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const input = parseOrThrow(forgotPasswordSchema, values);
    if (getDataMode() !== "supabase") {
      throw new AppError(
        "NOT_CONFIGURED",
        "Password reset emails aren't available on this server yet.",
      );
    }
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password` });
    // Same response whether or not the email exists, to avoid account enumeration.
    return { message: "If an account exists for that email, a reset link is on its way. Check your inbox." };
  });
}

export async function resetPasswordAction(values: ResetPasswordInput): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const input = parseOrThrow(resetPasswordSchema, values);
    if (getDataMode() !== "supabase") throw new AppError("NOT_CONFIGURED", "Password reset links are only available with Supabase Auth.");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new AppError("UNAUTHENTICATED", "This reset link has expired. Request a new one.");
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new AppError("VALIDATION", error.message, { password: error.message });
    return null;
  });
  if (result.ok) redirect("/overview");
  return result;
}
