"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { AmountInput, AmountPresets } from "@/components/shared/amount-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CABLE_PLANS,
  CABLE_PROVIDERS,
  DISCOS,
  ELECTRICITY_PRESETS_NAIRA,
  INTERNET_PLANS,
  INTERNET_PROVIDERS,
  UTILITY_BILLERS,
  type BillPlan,
  type PlanProvider,
} from "@/lib/catalog/billers";
import { describeFee } from "@/lib/fees";
import { formatNaira } from "@/lib/money";
import {
  cableSchema,
  electricitySchema,
  internetSchema,
  utilitySchema,
  type CableInput,
  type ElectricityInput,
  type InternetInput,
  type UtilityInput,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-utils";
import { PaymentFlow, type PaymentFlowApi } from "./payment-flow";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

function Submit({ busy, label = "Continue" }: { busy: boolean; label?: string }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={busy}>
      {busy ? (
        <>
          <LoaderCircle className="size-4 animate-spin" /> Verifying customer…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

function SegmentedChoice<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            `rounded-xl border p-3 text-left ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
            tileClass(value === o.value),
          )}
        >
          <span className="block text-sm font-medium">{o.label}</span>
          <span className="block text-xs text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

function ProviderTiles({ providers, value, onChange }: { providers: readonly PlanProvider[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Provider" className="grid grid-cols-3 gap-2">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          onClick={() => onChange(p.id)}
          className={cn(
            `flex h-14 items-center justify-center rounded-xl border px-2 text-sm font-semibold ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
            tileClass(value === p.id),
          )}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function PlanList({ plans, value, onChange }: { plans: BillPlan[]; value: string; onChange: (id: string) => void }) {
  if (plans.length === 0) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Choose a provider to see plans.</p>;
  return (
    <div role="radiogroup" aria-label="Plans" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {plans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          role="radio"
          aria-checked={value === plan.id}
          onClick={() => onChange(plan.id)}
          className={cn(
            `flex items-center justify-between gap-3 rounded-xl border p-3 text-left ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
            tileClass(value === plan.id),
          )}
        >
          <span>
            <span className="block text-sm font-medium">{plan.name}</span>
            <span className="block text-xs text-muted-foreground">{plan.validity}</span>
          </span>
          <span className="text-sm font-semibold tabular">{formatNaira(plan.price, { trimZeroKobo: true })}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ElectricityForm({ api }: { api: PaymentFlowApi }) {
  const form = useForm<ElectricityInput>({
    resolver: zodResolver(electricitySchema),
    mode: "onTouched",
    defaultValues: { discoId: "", meterType: "prepaid", meterNumber: "", amount: "" },
  });
  const onSubmit = form.handleSubmit(async (values) => applyServerErrors(form, await api.review({ kind: "electricity", input: values })));
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="discoId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="disco">Electricity provider</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="disco" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Select your DisCo" />
                </SelectTrigger>
                <SelectContent>
                  {DISCOS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} <span className="text-muted-foreground">· {d.region}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="meterType"
          render={({ field }) => (
            <Field>
              <FieldLabel>Meter type</FieldLabel>
              <SegmentedChoice
                label="Meter type"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "prepaid", label: "Prepaid", hint: "Get a token to load" },
                  { value: "postpaid", label: "Postpaid", hint: "Pay your monthly bill" },
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="meterNumber"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="meterNumber">Meter number</FieldLabel>
              <Input
                id="meterNumber"
                inputMode="numeric"
                placeholder="11–13 digit meter number"
                className="font-mono tracking-wide"
                {...field}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 13))}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>We verify the meter and show the customer name before you pay.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="elec-amount">Amount</FieldLabel>
              <AmountInput id="elec-amount" size="lg" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
              <AmountPresets presets={ELECTRICITY_PRESETS_NAIRA} onPick={field.onChange} current={field.value} />
              <FieldDescription>₦1,000 – ₦500,000 · {describeFee("electricity")}</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Submit busy={api.reviewing} />
    </form>
  );
}

function CableForm({ api }: { api: PaymentFlowApi }) {
  const form = useForm<CableInput>({
    resolver: zodResolver(cableSchema),
    mode: "onTouched",
    defaultValues: { providerId: "", smartcardNumber: "", planId: "" },
  });
  const providerId = useWatch({ control: form.control, name: "providerId" });
  const provider = CABLE_PROVIDERS.find((p) => p.id === providerId);
  const plans = CABLE_PLANS.filter((p) => p.providerId === providerId);
  const onSubmit = form.handleSubmit(async (values) => applyServerErrors(form, await api.review({ kind: "cable_tv", input: values })));
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="providerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Provider</FieldLabel>
              <ProviderTiles
                providers={CABLE_PROVIDERS}
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  form.setValue("planId", "");
                }}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="smartcardNumber"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="smartcard">{provider?.identifierLabel ?? "Smartcard / IUC number"}</FieldLabel>
              <Input
                id="smartcard"
                inputMode="numeric"
                placeholder="10–11 digits"
                className="font-mono tracking-wide"
                {...field}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
                aria-invalid={fieldState.invalid}
              />
              {provider && <FieldDescription>{provider.identifierHint}</FieldDescription>}
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="planId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Subscription plan</FieldLabel>
              <PlanList plans={plans} value={field.value} onChange={field.onChange} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Submit busy={api.reviewing} />
    </form>
  );
}

function InternetForm({ api }: { api: PaymentFlowApi }) {
  const form = useForm<InternetInput>({
    resolver: zodResolver(internetSchema),
    mode: "onTouched",
    defaultValues: { providerId: "", customerId: "", planId: "" },
  });
  const providerId = useWatch({ control: form.control, name: "providerId" });
  const provider = INTERNET_PROVIDERS.find((p) => p.id === providerId);
  const plans = INTERNET_PLANS.filter((p) => p.providerId === providerId);
  const onSubmit = form.handleSubmit(async (values) => applyServerErrors(form, await api.review({ kind: "internet", input: values })));
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="providerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Provider</FieldLabel>
              <ProviderTiles
                providers={INTERNET_PROVIDERS}
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  form.setValue("planId", "");
                }}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="customerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="internet-customer">{provider?.identifierLabel ?? "Customer ID"}</FieldLabel>
              <Input id="internet-customer" placeholder="e.g. SPC204518" autoComplete="off" {...field} aria-invalid={fieldState.invalid} />
              {provider && <FieldDescription>{provider.identifierHint}</FieldDescription>}
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="planId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Plan</FieldLabel>
              <PlanList plans={plans} value={field.value} onChange={field.onChange} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Submit busy={api.reviewing} />
    </form>
  );
}

function UtilityForm({ api }: { api: PaymentFlowApi }) {
  const form = useForm<UtilityInput>({
    resolver: zodResolver(utilitySchema),
    mode: "onTouched",
    defaultValues: { billerId: "", customerId: "", amount: "" },
  });
  const billerId = useWatch({ control: form.control, name: "billerId" });
  const biller = UTILITY_BILLERS.find((b) => b.id === billerId);
  const onSubmit = form.handleSubmit(async (values) => applyServerErrors(form, await api.review({ kind: "utility", input: values })));
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="billerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="biller">Biller</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="biller" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Select a biller" />
                </SelectTrigger>
                <SelectContent>
                  {UTILITY_BILLERS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="customerId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="utility-customer">{biller?.identifierLabel ?? "Customer reference"}</FieldLabel>
              <Input id="utility-customer" autoComplete="off" placeholder="e.g. LAW-778120" {...field} aria-invalid={fieldState.invalid} />
              {biller && <FieldDescription>{biller.identifierHint}</FieldDescription>}
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="utility-amount">Amount</FieldLabel>
              <AmountInput id="utility-amount" size="lg" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
              <FieldDescription>₦500 – ₦1,000,000 · {describeFee("utility")}</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Submit busy={api.reviewing} />
    </form>
  );
}

export function ElectricityPanel() {
  return <PaymentFlow reviewTitle="Confirm electricity payment">{(api) => <ElectricityForm api={api} />}</PaymentFlow>;
}
export function CablePanel() {
  return <PaymentFlow reviewTitle="Confirm cable TV subscription">{(api) => <CableForm api={api} />}</PaymentFlow>;
}
export function InternetPanel() {
  return <PaymentFlow reviewTitle="Confirm internet subscription">{(api) => <InternetForm api={api} />}</PaymentFlow>;
}
export function UtilityPanel() {
  return <PaymentFlow reviewTitle="Confirm bill payment">{(api) => <UtilityForm api={api} />}</PaymentFlow>;
}
