import Link from "next/link";
import { ArrowLeftRight, ReceiptText, ScrollText, Smartphone, Trophy, Wifi, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The lead action wears the luminous brand fill; the rest share one restrained brand tint.
const ACTIONS: { href: string; label: string; icon: LucideIcon; lead?: boolean }[] = [
  { href: "/transfer", label: "Transfer money", icon: ArrowLeftRight, lead: true },
  { href: "/airtime", label: "Buy airtime", icon: Smartphone },
  { href: "/airtime?tab=data", label: "Buy data", icon: Wifi },
  { href: "/bills", label: "Pay bills", icon: ReceiptText },
  { href: "/betting", label: "Fund betting wallet", icon: Trophy },
  { href: "/transactions", label: "View transactions", icon: ScrollText },
];

export function QuickActions() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-3 gap-2">
          {ACTIONS.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                className="group flex h-full flex-col items-center gap-2 rounded-xl border border-transparent p-2.5 text-center transition-colors duration-200 outline-none hover:border-brand-soft-border/70 hover:bg-brand-soft/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl transition-[transform,box-shadow,filter] duration-200 group-hover:-translate-y-0.5",
                    action.lead
                      ? "bg-brand-gradient text-brand-foreground shadow-glow-sm group-hover:shadow-glow group-hover:brightness-110"
                      : "bg-brand-soft text-brand-vivid ring-1 ring-brand-soft-border/70 ring-inset group-hover:shadow-glow-tile",
                  )}
                >
                  <action.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-xs leading-tight font-medium text-foreground">{action.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
