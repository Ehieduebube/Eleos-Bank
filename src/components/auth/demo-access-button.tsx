"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle, Sparkles } from "lucide-react";
import { enterDemoAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function DemoAccessButton() {
  const [pending, startTransition] = useTransition();
  return (
    <div className="rounded-2xl border border-brand-soft-border bg-brand-soft/70 p-4">
      <p className="text-sm font-semibold">Just exploring?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Look around a ready-made account. No sign-up needed.</p>
      <Button
        type="button"
        size="lg"
        className="mt-3 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await enterDemoAction();
            if (result && !result.ok) toast.error(result.error.message);
          })
        }
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {pending ? "Opening…" : "Explore the demo account"}
      </Button>
    </div>
  );
}
