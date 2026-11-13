"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Bell, CheckCheck, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { markNotificationsReadAction } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { timeAgo } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStartNavigation } from "./route-transition";

const KIND_ICON = { transaction: ReceiptText, security: ShieldCheck, system: Sparkles } as const;

export function NotificationsMenu({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const startNavigation = useStartNavigation();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [items, markRead] = useOptimistic(notifications, (state, ids: string[] | "all") =>
    state.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
  );
  const unread = items.filter((n) => !n.readAt).length;

  const markAll = () =>
    startTransition(async () => {
      markRead("all");
      await markNotificationsReadAction();
    });

  const openItem = (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) {
      startTransition(async () => {
        markRead([n.id]);
        await markNotificationsReadAction([n.id]);
      });
    }
    if (n.link) {
      startNavigation(n.link);
      router.push(n.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-gradient px-1 text-[0.625rem] leading-4 font-semibold text-primary-foreground shadow-glow-sm ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-brand-soft/60 focus-visible:bg-brand-soft/60", !n.readAt && "bg-brand-soft/50")}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-vivid">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn("text-sm", !n.readAt ? "font-semibold" : "font-medium")}>{n.title}</span>
                          <span className="shrink-0 text-[0.7rem] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                      </span>
                      {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-glow shadow-[0_0_0_3px_color-mix(in_oklch,var(--brand-glow)_22%,transparent)]" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        <div className="border-t px-4 py-2.5 text-center">
          <Link href="/settings?tab=notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-brand-vivid hover:underline">
            Notification preferences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
