import Link from "next/link";
import { ArrowLeftRight, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";

const POINTS = [
  { icon: ArrowLeftRight, text: "Send money to any Nigerian bank with account-name verification" },
  { icon: Smartphone, text: "Buy airtime and data for MTN, Airtel, Glo and 9mobile" },
  { icon: ReceiptText, text: "Pay electricity, cable TV, internet and betting wallets" },
  { icon: ShieldCheck, text: "Transaction PIN, idempotent payments and a double-entry style ledger" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-surface p-10 text-navy-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid-faint absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-32 -right-24 size-[26rem] rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-24 size-[28rem] rounded-full border-[40px] border-emerald-400/10" aria-hidden="true" />
        <div className="relative flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-lg font-semibold tracking-tight">Eleos</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Everyday banking, built for Nigeria.</h2>
          <p className="mt-3 text-white/70">Transfers, airtime, bills and cards — everything you need in one app.</p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point.text} className="flex items-start gap-3 text-sm text-white/85">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] ring-1 ring-white/10">
                  <point.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="pt-1.5">{point.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Eleos</p>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="lg:hidden">
          <Link href="/sign-in" aria-label="Eleos home">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground lg:hidden">© {new Date().getFullYear()} Eleos</p>
      </main>
    </div>
  );
}
