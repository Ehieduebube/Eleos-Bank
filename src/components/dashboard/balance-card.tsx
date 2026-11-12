"use client";

import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Plus } from "lucide-react";
import { useBalanceVisibility } from "@/components/layout/balance-visibility";
import { Amount } from "@/components/shared/amount";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/types";
import { AddFundsDialog } from "./add-funds-dialog";

export function BalanceCard({ account, pendingHold }: { account: Account; pendingHold: number }) {
  const { hidden, toggle } = useBalanceVisibility();
  return (
    <section
      aria-labelledby="balance-heading"
      className="sheen relative overflow-hidden rounded-2xl bg-brand-surface p-5 text-navy-foreground shadow-glow-surface sm:p-6"
    >
      <div className="bg-grid-faint pointer-events-none absolute inset-0" aria-hidden="true" />
      {/* Ambient light: a soft brand bloom behind the figure and a hairline highlight on the top edge. */}
      <div className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/35 to-transparent" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 id="balance-heading" className="text-sm font-medium text-white/75">
              Available balance
            </h2>
            <button
              type="button"
              onClick={toggle}
              className="flex size-7 items-center justify-center rounded-md text-white/70 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/40"
              aria-label={hidden ? "Show balance" : "Hide balance"}
              aria-pressed={hidden}
            >
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <p className="mt-3 text-[2rem] leading-none font-semibold tracking-tight sm:text-[2.6rem]" aria-live="polite">
          <Amount kobo={account.balance} hidden={hidden} />
        </p>
        {pendingHold > 0 && !hidden && (
          <p className="mt-2 text-xs text-white/65">
            Includes <Amount kobo={pendingHold} /> held for pending payments
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-white/60">Account number</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-mono text-[0.95rem] tracking-wide">
              {account.accountNumber}
              <CopyButton value={account.accountNumber} label="Copy account number" className="size-7 text-white/70 hover:bg-white/10 hover:text-white" />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-white/60">Account name</dt>
            <dd className="mt-0.5 truncate font-medium">{account.accountName}</dd>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className="text-xs text-white/60">Bank</dt>
            <dd className="mt-0.5 truncate font-medium">{account.bankName}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="lg" variant="inverse">
            <Link href="/transfer">
              <ArrowUpRight className="size-4" /> Send money
            </Link>
          </Button>
          <AddFundsDialog
            trigger={
              <Button size="lg" variant="glass">
                <Plus className="size-4" /> Add money
              </Button>
            }
          />
        </div>
      </div>
    </section>
  );
}
