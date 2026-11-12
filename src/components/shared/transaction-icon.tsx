import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Droplet,
  Router,
  Smartphone,
  Trophy,
  Tv,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

// Money in keeps the success green; every outgoing type shares the brand tint so
// status colours (amber, red) stay reserved for meaning.
const OUTGOING = "bg-brand-soft text-brand-vivid";
const ICONS: Record<TransactionType, { Icon: LucideIcon; tone: string }> = {
  transfer: { Icon: ArrowUpRight, tone: OUTGOING },
  credit: { Icon: ArrowDownLeft, tone: "bg-success-soft text-success" },
  airtime: { Icon: Smartphone, tone: OUTGOING },
  data: { Icon: Wifi, tone: OUTGOING },
  electricity: { Icon: Zap, tone: OUTGOING },
  cable_tv: { Icon: Tv, tone: OUTGOING },
  internet: { Icon: Router, tone: OUTGOING },
  utility: { Icon: Droplet, tone: OUTGOING },
  betting: { Icon: Trophy, tone: OUTGOING },
  card: { Icon: CreditCard, tone: OUTGOING },
};

export function TransactionIcon({ type, className }: { type: TransactionType; className?: string }) {
  const { Icon, tone } = ICONS[type];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone, className)} aria-hidden="true">
      <Icon className="size-[1.1rem]" />
    </span>
  );
}
