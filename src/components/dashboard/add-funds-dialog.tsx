"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { addDemoFundsAction } from "@/actions/payments";
import { AmountInput, AmountPresets } from "@/components/shared/amount-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNaira } from "@/lib/money";
import { creditSchema, type CreditInput } from "@/lib/validation";

const SOURCES: { value: CreditInput["source"]; label: string }[] = [
  { value: "topup", label: "Top-up" },
  { value: "salary", label: "Salary credit" },
  { value: "transfer", label: "Incoming transfer" },
  { value: "refund", label: "Merchant refund" },
];

/** Simulate an incoming credit so the "money in" path can be exercised. */
export function AddFundsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // One idempotency key per opened dialog: a retried submission cannot credit twice.
  const [submissionKey, setSubmissionKey] = useState("");
  const form = useForm<CreditInput>({ resolver: zodResolver(creditSchema), defaultValues: { amount: "", source: "topup" } });

  const onOpenChange = (next: boolean) => {
    if (next) {
      setSubmissionKey(crypto.randomUUID());
      form.reset({ amount: "", source: "topup" });
    }
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    if (pending) return;
    startTransition(async () => {
      const result = await addDemoFundsAction(values, submissionKey);
      if (!result.ok) {
        toast.error(result.error.message);
        if (result.error.fieldErrors?.amount) form.setError("amount", { message: result.error.fieldErrors.amount });
        return;
      }
      toast.success(`${formatNaira(result.data.transaction.amount)} received`, {
        description: `New balance: ${formatNaira(result.data.balance)}`,
      });
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Plus className="size-4" /> Add money
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add money</DialogTitle>
          <DialogDescription>Fund your Eleos account. Up to ₦5,000,000 at a time.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Controller
            control={form.control}
            name="source"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="credit-source">Credit type</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="credit-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
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
                <FieldLabel htmlFor="credit-amount">Amount</FieldLabel>
                <AmountInput id="credit-amount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
                <AmountPresets presets={[10_000, 50_000, 250_000, 1_000_000]} onPick={field.onChange} current={field.value} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Posting credit…" : "Add funds"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
