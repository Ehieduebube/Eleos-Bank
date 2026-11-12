"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MOBILE_PRIMARY, NAV_ITEMS, isActive } from "./nav-items";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

/** Icon holder: the active destination sits in a small luminous brand pill. */
function NavIndicator({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-200",
        active ? "bg-brand-gradient text-brand-foreground shadow-glow-sm" : "group-hover:bg-brand-soft group-hover:text-brand-vivid",
      )}
    >
      {children}
    </span>
  );
}

/** Bottom navigation for phones and small tablets; "More" opens every destination. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV_ITEMS.filter((item) => MOBILE_PRIMARY.includes(item.href));
  const moreActive = !primary.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium outline-none focus-visible:bg-brand-soft",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <NavIndicator active={active}>
                  <item.icon className="size-[1.15rem]" aria-hidden="true" />
                </NavIndicator>
                {item.label === "Airtime & Data" ? "Airtime" : item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                "group flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium outline-none focus-visible:bg-brand-soft",
                moreActive ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <NavIndicator active={moreActive}>
                <Menu className="size-[1.15rem]" aria-hidden="true" />
              </NavIndicator>
              More
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
                <SheetDescription>All Eleos services</SheetDescription>
              </SheetHeader>
              <ul className="grid grid-cols-3 gap-2 px-4">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          `flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${TILE_TRANSITION}`,
                          "text-foreground", tileClass(active),
                        )}
                      >
                        <item.icon className="size-5" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action={signOutAction} className="px-4">
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <LogOut className="size-4" aria-hidden="true" /> Sign out
                </button>
              </form>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
