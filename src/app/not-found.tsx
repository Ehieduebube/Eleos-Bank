import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-vivid shadow-glow-tile">
        <Compass className="size-6" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">The page or receipt you&apos;re looking for doesn&apos;t exist or isn&apos;t yours.</p>
      </div>
      <Button asChild>
        <Link href="/overview">Back to overview</Link>
      </Button>
    </div>
  );
}
