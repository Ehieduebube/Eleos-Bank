"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReceiptActions() {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2">
      <Button asChild variant="ghost">
        <Link href="/transactions">
          <ArrowLeft className="size-4" /> Transactions
        </Link>
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="size-4" /> Print or save as PDF
      </Button>
    </div>
  );
}
