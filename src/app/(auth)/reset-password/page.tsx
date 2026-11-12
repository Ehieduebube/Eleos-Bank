import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/shared/notice";
import { getSessionUser } from "@/server/auth/session";
import { getDataMode } from "@/server/config";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  await connection();
  const supabase = getDataMode() === "supabase";
  const user = supabase ? await getSessionUser() : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">You&apos;ll be signed in once it&apos;s updated.</p>
      </div>
      {!supabase ? (
        <Notice>Password reset isn&apos;t available on this server yet.</Notice>
      ) : !user ? (
        <Notice>
          This reset link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="font-medium text-brand-vivid hover:underline">
            Request a new one
          </Link>
          .
        </Notice>
      ) : (
        <ResetPasswordForm />
      )}
    </div>
  );
}
