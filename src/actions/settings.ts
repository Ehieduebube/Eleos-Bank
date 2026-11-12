"use server";

import { z } from "zod";
import { parseNairaToKobo } from "@/lib/money";
import type { ActionResult, UserPreferences, VirtualCard } from "@/lib/types";
import {
  cardLimitsSchema,
  changePasswordSchema,
  pinSchema,
  preferencesSchema,
  profileSchema,
  type CardLimitsInput,
  type ChangePasswordInput,
  type PinInput,
  type PreferencesInput,
  type ProfileInput,
} from "@/lib/validation";
import { parseOrThrow, requireActionUser, revalidateApp, runAction } from "@/server/action-utils";
import { hashSecret, verifySecret } from "@/server/auth/crypto";
import { changeLocalPassword, revokeLocalSession, revokeOtherLocalSessions } from "@/server/auth/local-auth";
import { getDataMode, getAppUrl } from "@/server/config";
import { getRepository } from "@/server/context";
import { AppError } from "@/server/errors";
import { createSupabaseServerClient } from "@/server/supabase/clients";

export async function updateProfileAction(values: ProfileInput): Promise<ActionResult<{ message: string }>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const input = parseOrThrow(profileSchema, values);
    if (user.isDemoUser && input.email !== user.email) {
      throw new AppError("FORBIDDEN", "The shared demo profile's email can't be changed. Create your own account to try this.", { email: "Not available on the shared demo profile" });
    }
    const repo = await getRepository();
    let message = "Profile updated.";
    if (repo.mode === "supabase") {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.updateUser({ data: { full_name: input.fullName } });
      if (input.email !== user.email) {
        const { error } = await supabase.auth.updateUser({ email: input.email }, { emailRedirectTo: `${getAppUrl()}/auth/callback?next=/settings` });
        if (error) throw new AppError("VALIDATION", error.message, { email: error.message });
        message = "Profile updated. Check your new inbox to confirm the email change.";
      }
      await repo.updateProfile(user.id, { fullName: input.fullName, phone: input.phone || null });
    } else {
      await repo.updateProfile(user.id, { fullName: input.fullName, email: input.email, phone: input.phone || null });
    }
    return { message };
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function changePasswordAction(values: ChangePasswordInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const input = parseOrThrow(changePasswordSchema, values);
    if (user.isDemoUser) throw new AppError("FORBIDDEN", "The shared demo profile has no password to change. Create your own account to try this.");
    if (getDataMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      // Re-authenticate with the current password before changing it.
      const { error: reauth } = await supabase.auth.signInWithPassword({ email: user.email, password: input.currentPassword });
      if (reauth) throw new AppError("VALIDATION", "Your current password is incorrect.", { currentPassword: "Your current password is incorrect." });
      const { error } = await supabase.auth.updateUser({ password: input.newPassword });
      if (error) throw new AppError("VALIDATION", error.message, { newPassword: error.message });
      await supabase.auth.signOut({ scope: "others" });
    } else {
      await changeLocalPassword(user.id, input.currentPassword, input.newPassword);
    }
    return null;
  });
}

/** Set or change the 4-digit transaction PIN. Stored only as a salted scrypt hash. */
export async function setTransactionPinAction(values: PinInput): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    // The demo account is shared by every visitor: a PIN set by one would lock out all the others.
    if (user.isDemoUser) throw new AppError("FORBIDDEN", "The demo account is shared, so it can't have a PIN. Create your own account to set one.");
    const input = parseOrThrow(pinSchema, values);
    const repo = await getRepository();
    const record = await repo.getPinRecord(user.id);
    if (record.pinHash) {
      if (record.lockedUntil && new Date(record.lockedUntil).getTime() > Date.now()) {
        throw new AppError("PIN_LOCKED", "Your PIN is locked after too many attempts. Try again in 15 minutes.");
      }
      const ok = await verifySecret(input.currentPin, record.pinHash);
      await repo.recordPinAttempt(user.id, ok);
      if (!ok) throw new AppError("PIN_INVALID", "Your current PIN is incorrect.", { currentPin: "Your current PIN is incorrect." });
    }
    await repo.setPinHash(user.id, await hashSecret(input.pin));
    await repo.createNotification(user.id, {
      kind: "security",
      title: record.pinHash ? "Transaction PIN changed" : "Transaction PIN set",
      body: "Your PIN will be required to confirm transfers and payments.",
      link: "/settings?tab=security",
    });
    return null;
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function updatePreferencesAction(values: PreferencesInput): Promise<ActionResult<UserPreferences>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const patch = parseOrThrow(preferencesSchema, values);
    return (await getRepository()).updatePreferences(user.id, patch);
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    if (getDataMode() === "supabase") throw new AppError("VALIDATION", "Use “Sign out other sessions” with Supabase Auth.");
    await revokeLocalSession(user.id, parseOrThrow(z.uuid(), sessionId));
    return null;
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function signOutOtherSessionsAction(): Promise<ActionResult<{ message: string }>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    if (getDataMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw new AppError("INTERNAL", "Could not sign out other sessions.");
      return { message: "All other sessions have been signed out." };
    }
    const count = await revokeOtherLocalSessions(user.id);
    return { message: count ? `Signed out ${count} other session${count === 1 ? "" : "s"}.` : "No other active sessions." };
  });
  if (result.ok) revalidateApp();
  return result;
}

/** Restore the simulated account to its initial ₦45,140,708.60 state. Explicit, confirmed user action only. */
export async function resetDemoAccountAction(confirmation: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    if (confirmation !== "RESET") throw new AppError("VALIDATION", "Type RESET to confirm.", { confirmation: "Type RESET to confirm" });
    const repo = await getRepository();
    await repo.resetDemoData(user.id);
    // The shared demo profile is used by many visitors: clear any PIN so nobody stays locked out.
    if (user.isDemoUser) await repo.setPinHash(user.id, null);
    return null;
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function setCardFrozenAction(frozen: boolean): Promise<ActionResult<VirtualCard>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const repo = await getRepository();
    const card = await repo.updateCard(user.id, { frozen: parseOrThrow(z.boolean(), frozen) });
    await repo.createNotification(user.id, {
      kind: "security",
      title: frozen ? "Virtual card frozen" : "Virtual card unfrozen",
      body: frozen ? `Card •••• ${card.last4} will decline all purchases until you unfreeze it.` : `Card •••• ${card.last4} can be used again.`,
      link: "/cards",
    });
    return card;
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function setCardOnlinePaymentsAction(enabled: boolean): Promise<ActionResult<VirtualCard>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    return (await getRepository()).updateCard(user.id, { onlinePayments: parseOrThrow(z.boolean(), enabled) });
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function updateCardLimitsAction(values: CardLimitsInput): Promise<ActionResult<VirtualCard>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const input = parseOrThrow(cardLimitsSchema, values);
    return (await getRepository()).updateCard(user.id, {
      dailyLimit: parseNairaToKobo(input.dailyLimit)!,
      monthlyLimit: parseNairaToKobo(input.monthlyLimit)!,
    });
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const parsed = ids ? parseOrThrow(z.array(z.uuid()).max(100), ids) : undefined;
    await (await getRepository()).markNotificationsRead(user.id, parsed);
    return null;
  });
  if (result.ok) revalidateApp();
  return result;
}
