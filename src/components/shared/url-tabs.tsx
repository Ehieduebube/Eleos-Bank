"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface UrlTab {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

/** Tabs whose active value lives in ?tab= so links and refreshes land on the right tab. */
export function UrlTabs({ tabs, defaultValue, className, listClassName }: { tabs: UrlTab[]; defaultValue: string; className?: string; listClassName?: string }) {
  const searchParams = useSearchParams();
  const current = searchParams.get("tab");
  const value = tabs.some((t) => t.value === current) ? current! : defaultValue;

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        // Native history update: Next syncs useSearchParams from it without a server round trip,
        // so the tab switches instantly. (router.replace re-fetched the page on every click.)
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", next);
        window.history.replaceState(null, "", `?${params.toString()}`);
      }}
      className={cn("gap-5", className)}
    >
      <TabsList className={cn("scrollbar-none h-10! w-full justify-start overflow-x-auto sm:w-fit", listClassName)}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="px-3">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
