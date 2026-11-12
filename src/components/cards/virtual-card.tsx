import { Snowflake } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import type { VirtualCard } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Visual for the demo virtual card. Only the last four digits exist — no full
 * card number, CVV or PIN is generated, and the card is labelled as a demo.
 */
export function VirtualCardVisual({ card }: { card: VirtualCard }) {
  const expiry = `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`;
  return (
    <div className="relative mx-auto aspect-[1.586] w-full max-w-sm">
      <div
        className={cn(
          "sheen absolute inset-0 overflow-hidden rounded-2xl bg-brand-surface p-5 text-white shadow-glow-surface transition-[filter] duration-300",
          card.frozen && "grayscale-[0.7] saturate-50",
        )}
        role="img"
        aria-label={`Virtual card ending ${card.last4}, ${card.frozen ? "frozen" : "active"}, expires ${expiry}`}
      >
        <div className="bg-grid-faint absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-20 -right-16 size-56 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/35 to-transparent" aria-hidden="true" />
        <div className="absolute -right-10 -bottom-16 size-52 rounded-full border-[18px] border-emerald-400/15" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <LogoMark className="size-7" />
              <span className="text-sm font-semibold">Eleos</span>
            </div>
            <span className="text-[0.65rem] font-semibold tracking-widest text-white/70 uppercase">Virtual</span>
          </div>
          <div aria-hidden="true">
            <div className="mb-3 h-7 w-10 rounded-md bg-linear-to-br from-amber-200/80 to-amber-400/60" />
            <p className="font-mono text-lg tracking-[0.2em] sm:text-xl">•••• •••• •••• {card.last4}</p>
          </div>
          <div className="flex items-end justify-between gap-4 text-xs" aria-hidden="true">
            <div className="min-w-0">
              <p className="text-white/55 uppercase">Cardholder</p>
              <p className="truncate font-medium tracking-wide">{card.cardholderName}</p>
            </div>
            <div className="text-right">
              <p className="text-white/55 uppercase">Expires</p>
              <p className="font-mono font-medium">{expiry}</p>
            </div>
            <p className="text-sm font-semibold tracking-tight text-white/80 italic">VIRTUAL</p>
          </div>
        </div>
      </div>
      {card.frozen && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-brand-200/10 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-brand shadow">
            <Snowflake className="size-4" aria-hidden="true" /> Frozen
          </span>
        </div>
      )}
    </div>
  );
}
