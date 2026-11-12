"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ellipsis, Pencil, Search, Send, Trash, UserPlus, Users } from "lucide-react";
import { deleteBeneficiaryAction } from "@/actions/beneficiaries";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { initials, maskAccountNumber, timeAgo } from "@/lib/format";
import type { Beneficiary } from "@/lib/types";
import { BeneficiaryFormDialog } from "./beneficiary-form-dialog";

export function BeneficiaryList({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Beneficiary | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return beneficiaries;
    return beneficiaries.filter((b) => [b.accountName, b.nickname ?? "", b.bankName, b.accountNumber.slice(-4)].join(" ").toLowerCase().includes(q));
  }, [beneficiaries, query]);

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteBeneficiaryAction(target.id);
      if (result.ok) toast.success(`${target.nickname ?? target.accountName} removed`);
      else toast.error(result.error.message);
      setDeleting(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, nickname or bank" aria-label="Search beneficiaries" className="pl-9" />
        </div>
        <Button
          className="h-10"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <UserPlus className="size-4" /> Add beneficiary
        </Button>
      </div>

      {beneficiaries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No saved beneficiaries"
          description="Save people you pay often to send money in a couple of taps."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus className="size-4" /> Add your first beneficiary
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description={`Nothing matches “${query}”.`} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
              <Avatar className="size-11">
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials(b.accountName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.nickname ?? b.accountName}</p>
                {b.nickname && <p className="truncate text-xs text-muted-foreground">{b.accountName}</p>}
                <p className="truncate text-xs text-muted-foreground">
                  {b.bankName} · <span className="font-mono">{maskAccountNumber(b.accountNumber)}</span>
                </p>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground" suppressHydrationWarning>{b.lastUsedAt ? `Last paid ${timeAgo(b.lastUsedAt)}` : "Not paid yet"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild size="icon" variant="secondary" aria-label={`Send money to ${b.nickname ?? b.accountName}`}>
                  <Link href={`/transfer?beneficiary=${b.id}`}>
                    <Send className="size-4" />
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`More actions for ${b.nickname ?? b.accountName}`}>
                      <Ellipsis className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(b);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(b)}>
                      <Trash /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BeneficiaryFormDialog open={formOpen} onOpenChange={setFormOpen} beneficiary={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && !pending && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this beneficiary?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.nickname ?? deleting?.accountName} ({deleting?.bankName}, {deleting && maskAccountNumber(deleting.accountNumber)}) will be removed from your saved list. Past transactions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
