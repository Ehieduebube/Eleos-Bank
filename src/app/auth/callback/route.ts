import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/server/action-utils";
import { getDataMode } from "@/server/config";
import { createSupabaseServerClient } from "@/server/supabase/clients";

/**
 * Supabase Auth redirect target for email confirmation, password recovery and
 * email-change links. Exchanges the one-time code for a session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  if (getDataMode() !== "supabase") {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/sign-in?error=link_expired", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
