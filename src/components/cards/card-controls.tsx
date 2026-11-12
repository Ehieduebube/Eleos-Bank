"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useOptimistic, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { CreditCard, Globe, Pencil, ShoppingBag, Snowflake } from "lucide-react";
import { simulateCardPurchaseAction } from "@/actions/payments";
import { setCardFrozenAction, setCardOnlinePaymentsAction, updateCardLimitsAction } from "@/actions/settings";
import { AmountInput } from "@/components/shared/amount-input";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEMO_MERCHANTS } from "@/lib/catalog/merchants";
import { formatNaira, koboToInputString } from "@/lib/money";
import type { VirtualCard } from "@/lib/types";
import { cardLimitsSchema, cardPurchaseSchema, type CardLimitsInput, type CardPurchaseInput } from "@/lib/validation";
import { VirtualCardVisual } from "./virtual-card";

function ToggleRow({ id, icon, title, description, checked, onChange, disabled }: { id: string; icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-vivid">{icon}</span>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function LimitsDialog({ card }: { card: VirtualCard }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<CardLimitsInput>({
    resolver: zodResolver(cardLimitsSchema),
    defaultValues: { dailyLimit: koboToInputString(card.dailyLimit), monthlyLimit: koboToInputString(card.monthlyLimit) },
  });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateCardLimitsAction(values);
      if (!result.ok) return void toast.error(result.error.message);
      toast.success("Spending limits updated");
      setOpen(false);
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset({ dailyLimit: koboToInputString(card.dailyLimit), monthlyLimit: koboToInputString(card.monthlyLimit) });
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Edit limits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Spending limits</DialogTitle>
          <DialogDescription>Purchases above these limits are declined.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FieldGroup>
            {(["dailyLimit", "monthlyLimit"] as const).map((name) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={name}>{name === "dailyLimit" ? "Daily limit" : "Monthly limit"}</FieldLabel>
                    <AmountInput id={name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save limits"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SimulatePurchaseDialog({ frozen }: { frozen: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [submissionKey, setSubmissionKey] = useState("");
  const form = useForm<CardPurchaseInput>({ resolver: zodResolver(cardPurchaseSchema), defaultValues: { merchantId: "netflix", amount: "7000" } });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await simulateCardPurchaseAction(values, submissionKey);
      if (!result.ok) return void toast.error(result.error.message);
      const txn = result.data.transaction;
      if (txn.status === "successful") toast.success(`${txn.description} approved`, { description: formatNaira(txn.total) });
      else toast.error(txn.failureReason ?? "Purchase declined");
      setOpen(false);
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSubmissionKey(crypto.randomUUID());
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <ShoppingBag className="size-4" /> Make a purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay with your card</DialogTitle>
          <DialogDescription>Pay a merchant with your Eleos virtual card. Freezes and spending limits apply.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FieldGroup>
            <Controller
              control={form.control}
              name="merchantId"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="merchant">Merchant</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="merchant" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_MERCHANTS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} <span className="text-muted-foreground">· {m.category}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="purchase-amount">Amount</FieldLabel>
                  <AmountInput id="purchase-amount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          {frozen && <Notice>Your card is frozen, so this purchase will be declined.</Notice>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Authorising…" : "Pay"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CardControls({ card, spentToday, spentThisMonth }: { card: VirtualCard; spentToday: number; spentThisMonth: number }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(card, (state, patch: Partial<VirtualCard>) => ({ ...state, ...patch }));

  const toggleFrozen = (frozen: boolean) =>
    startTransition(async () => {
      setOptimistic({ frozen });
      const result = await setCardFrozenAction(frozen);
      if (!result.ok) toast.error(result.error.message);
      else toast.success(frozen ? "Card frozen — all purchases will be declined" : "Card unfrozen");
    });

  const toggleOnline = (onlinePayments: boolean) =>
    startTransition(async () => {
      setOptimistic({ onlinePayments });
      const result = await setCardOnlinePaymentsAction(onlinePayments);
      if (!result.ok) toast.error(result.error.message);
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <VirtualCardVisual card={optimistic} />
        <p className="text-center text-xs text-muted-foreground">{card.label}</p>
        <SimulatePurchaseDialog frozen={optimistic.frozen} />
      </div>
      <div className="space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Card controls</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 py-0">
            <ToggleRow
              id="freeze"
              icon={<Snowflake className="size-4" />}
              title={optimistic.frozen ? "Card is frozen" : "Freeze card"}
              description="Temporarily block every purchase. Unfreeze any time."
              checked={optimistic.frozen}
              onChange={toggleFrozen}
            />
            <ToggleRow
              id="online"
              icon={<Globe className="size-4" />}
              title="Online payments"
              description="Allow web and in-app purchases."
              checked={optimistic.onlinePayments}
              onChange={toggleOnline}
              disabled={optimistic.frozen}
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" /> Spending limits
            </CardTitle>
            <CardDescription>Usage resets daily and monthly (WAT)</CardDescription>
            <CardAction>
              <LimitsDialog card={card} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Today", spent: spentToday, limit: card.dailyLimit },
              { label: "This month", spent: spentThisMonth, limit: card.monthlyLimit },
            ].map((row) => {
              const pct = Math.min(100, row.limit ? (row.spent / row.limit) * 100 : 0);
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground tabular">
                      {formatNaira(row.spent, { trimZeroKobo: true })} of {formatNaira(row.limit, { trimZeroKobo: true })}
                    </span>
                  </div>
                  <Progress value={pct} aria-label={`${row.label}: ${pct.toFixed(0)}% of limit used`} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
