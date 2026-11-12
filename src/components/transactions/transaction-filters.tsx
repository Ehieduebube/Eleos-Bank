"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FileDown, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/transaction-meta";
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from "@/lib/types";

const FILTER_KEYS = ["q", "type", "status", "from", "to", "sort"] as const;

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    next.delete("ref");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounce free-text search.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if ((params.get("q") ?? "") !== search.trim()) update({ q: search.trim() || null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the typed text changes
  }, [search]);

  const active = FILTER_KEYS.some((k) => params.get(k));
  const exportParams = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) exportParams.set(key, value);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description or reference"
            aria-label="Search transactions"
            className="pl-9"
          />
          {pending && <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating" />}
        </div>
        <Button asChild variant="outline" className="h-10">
          <a href={`/api/transactions/export?${exportParams.toString()}`} download>
            <FileDown className="size-4" /> Export CSV
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="f-type" className="text-xs text-muted-foreground">Type</Label>
          <Select value={params.get("type") ?? "all"} onValueChange={(v) => update({ type: v })}>
            <SelectTrigger id="f-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TRANSACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "credit" ? "Credits" : TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-status" className="text-xs text-muted-foreground">Status</Label>
          <Select value={params.get("status") ?? "all"} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger id="f-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TRANSACTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-from" className="text-xs text-muted-foreground">From</Label>
          <Input id="f-from" type="date" value={params.get("from") ?? ""} max={params.get("to") ?? undefined} onChange={(e) => update({ from: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-to" className="text-xs text-muted-foreground">To</Label>
          <Input id="f-to" type="date" value={params.get("to") ?? ""} min={params.get("from") ?? undefined} onChange={(e) => update({ to: e.target.value || null })} />
        </div>
        <div className="col-span-2 space-y-1 md:col-span-1">
          <Label htmlFor="f-sort" className="text-xs text-muted-foreground">Sort by</Label>
          <Select value={params.get("sort") ?? "date_desc"} onValueChange={(v) => update({ sort: v === "date_desc" ? null : v })}>
            <SelectTrigger id="f-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Amount: high to low</SelectItem>
              <SelectItem value="amount_asc">Amount: low to high</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X className="size-3.5" /> Clear filters
        </Button>
      )}
    </div>
  );
}
