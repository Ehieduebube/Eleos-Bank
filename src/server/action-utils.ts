import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { fieldErrorsFrom } from "@/lib/validation";
import { getSessionUser, type SessionUser } from "./auth/session";
import { AppError, Errors, isAppError } from "./errors";

/**
 * Run a server action body and convert the outcome into a serialisable
 * ActionResult. Expected failures (AppError) keep their code and message;
 * anything else is logged on the server and reported generically.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error); // let Next.js redirect()/notFound() propagate
    if (isAppError(error)) return { ok: false, error: error.toActionError() };
    console.error("[eleos] action failed", error);
    return { ok: false, error: { code: "INTERNAL", message: "Something went wrong on our side. No money was moved. Please try again." } };
  }
}

/** Resolve the session inside an action; actions never trust a user id from the client. */
export async function requireActionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("VALIDATION", "Please check the highlighted fields.", fieldErrorsFrom(result.error));
  return result.data;
}

/** Refresh every server-rendered view after a mutation (balances, lists, badges). */
export function revalidateApp() {
  revalidatePath("/", "layout");
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/overview";
  return next;
}
