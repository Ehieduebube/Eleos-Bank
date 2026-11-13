"use client";

import Link from "next/link";
import { useNavPathname } from "./route-transition";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Desktop navigation: a navy brand panel; the current page is a white pill. */
export function AppSidebar({ fullName, email }: { fullName: string; email: string }) {
  const pathname = useNavPathname();
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar-surface text-sidebar-foreground [color-scheme:dark] lg:flex"
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center px-5">
        <Link href="/overview" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60" aria-label="Eleos home">
          <Logo inverse />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="relative">
                {active && (
                  <span
                    className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-brand-300 shadow-[0_0_12px_1px_var(--brand-400)]"
                    aria-hidden="true"
                  />
                )}
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,box-shadow,filter] duration-200 outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60",
                    active
                      ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-[1.1rem] shrink-0 transition-colors duration-200",
                      active
                        ? "text-sidebar-active-icon"
                        : "text-sidebar-icon group-hover:text-brand-200",
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors duration-200 outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/60"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-white/10 text-xs font-semibold text-white ring-1 ring-white/15 ring-inset">{initials(fullName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{fullName}</span>
            <span className="block truncate text-xs text-sidebar-muted">{email}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
