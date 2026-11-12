"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { AmountInput, AmountPresets } from "@/components/shared/amount-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BETTING_PRESETS_NAIRA, enabledBettingProviders, getBettingProvider } from "@/lib/catalog/betting";
import { bettingSchema, type BettingInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-utils";
import { PaymentFlow, type PaymentFlowApi } from "./payment-flow";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

function BettingForm({ api, initialProvider }: { api: PaymentFlowApi; initialProvider?: string }) {
  const providers = enabledBettingProviders();
  const form = useForm<BettingInput>({
    resolver: zodResolver(bettingSchema),
    mode: "onTouched",
    defaultValues: { providerId: initialProvider && getBettingProvider(initialProvider)?.enabled ? initialProvider : "", customerId: "", amount: "" },
  });
  const providerId = useWatch({ control: form.control, name: "providerId" });
  const provider = getBettingProvider(providerId);
  const onSubmit = form.handleSubmit(async (values) => applyServerErrors(form, await api.review({ kind: "betting", input: values })));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="providerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Betting platform</FieldLabel>
              <div role="radiogroup" aria-label="Betting platform" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={field.value === p.id}
                    onClick={() => field.onChange(p.id)}
                    className={cn(
                      `flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
                      tileClass(field.value === p.id),
                    )}
                  >
                    <span className="size-3 shrink-0 rounded-full ring-2 ring-white/60" style={{ background: p.color }} aria-hidden="true" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="customerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bet-customer">{provider?.identifierLabel ?? "Customer ID"}</FieldLabel>
              <Input id="bet-customer" autoComplete="off" placeholder="e.g. TOLU2045" {...field} aria-invalid={fieldState.invalid} />
              <FieldDescription>{provider?.identifierHint ?? "We verify the account holder before you pay."}</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bet-amount">Amount</FieldLabel>
              <AmountInput id="bet-amount" size="lg" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
              <AmountPresets presets={BETTING_PRESETS_NAIRA} onPick={field.onChange} current={field.value} />
              <FieldDescription>₦100 – ₦2,000,000 · no fee</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={api.reviewing}>
        {api.reviewing ? (
          <>
            <LoaderCircle className="size-4 animate-spin" /> Verifying account…
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}

export function BettingPanel({ initialProvider }: { initialProvider?: string }) {
  return (
    <PaymentFlow reviewTitle="Confirm wallet funding" confirmVerb="Fund wallet ·">
      {(api) => <BettingForm api={api} initialProvider={initialProvider} />}
    </PaymentFlow>
  );
}
