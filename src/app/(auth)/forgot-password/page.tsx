import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { getDataMode } from "@/server/config";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  await connection(); // data mode is read from runtime env, not baked in at build time
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <ForgotPasswordForm localMode={getDataMode() === "local"} />
      <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-vivid hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
