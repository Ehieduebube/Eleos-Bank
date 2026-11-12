"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleExclamationPoint } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-destructive">
        <TriangleExclamationPoint className="size-6" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          We couldn&apos;t load this page. No transaction was affected. {error.digest && <span className="font-mono text-xs">Ref: {error.digest}</span>}
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
