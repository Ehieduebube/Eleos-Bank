import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoAccessButton } from "@/components/auth/demo-access-button";
import { SignInForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/server/auth/session";
import { isDemoAccessEnabled } from "@/server/config";
import { safeNextPath } from "@/server/action-utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  if (await getSessionUser()) redirect(next ?? "/overview");
  const linkExpired = params.error === "link_expired";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your Eleos account.</p>
      </div>
      {linkExpired && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">That link is invalid or has expired. Please try again.</p>}
      {isDemoAccessEnabled() && <DemoAccessButton />}
      <div className="relative text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border">
        <span className="relative bg-background px-2">or sign in with email</span>
      </div>
      <SignInForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New to Eleos?{" "}
        <Link href="/sign-up" className="font-medium text-brand-vivid hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
