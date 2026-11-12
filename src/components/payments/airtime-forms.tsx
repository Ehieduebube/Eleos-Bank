"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { LoaderCircle, UserRound } from "lucide-react";
import { AmountInput, AmountPresets } from "@/components/shared/amount-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AIRTIME_PRESETS_NAIRA, bundlesForNetwork, detectNetwork, getNetwork, type DataBundle, type NetworkId } from "@/lib/catalog/networks";
import { formatNaira } from "@/lib/money";
import { airtimeSchema, dataSchema, type AirtimeInput, type DataInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-utils";
import { NetworkPicker } from "./network-picker";
import { PaymentFlow, type PaymentFlowApi } from "./payment-flow";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

/** Phone field with "use my number" and prefix-based network detection. */
function PhoneField<T extends { phone: string; network: NetworkId }>({ form, ownPhone }: { form: UseFormReturn<T>; ownPhone: string | null }) {
  const manualNetwork = useRef(false);
  // RHF generics make shared field components awkward; the two forms share these field names.
  const f = form as unknown as UseFormReturn<{ phone: string; network: NetworkId }>;
  const [network, phone] = useWatch({ control: f.control, name: ["network", "phone"] });
  const detected = detectNetwork(phone ?? "");

  const onPhone = (value: string) => {
    const cleaned = value.replace(/[^\d+]/g, "").slice(0, 14);
    f.setValue("phone", cleaned, { shouldValidate: f.formState.isSubmitted });
    const net = detectNetwork(cleaned);
    if (net && !manualNetwork.current) f.setValue("network", net, { shouldValidate: true });
  };

  return (
    <>
      <Controller
        control={f.control}
        name="network"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Network</FieldLabel>
            <NetworkPicker
              value={field.value}
              onChange={(id) => {
                manualNetwork.current = true;
                field.onChange(id);
              }}
              invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        control={f.control}
        name="phone"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="phone">Phone number</FieldLabel>
              {ownPhone && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onPhone(ownPhone)}>
                  <UserRound className="size-3.5" /> Use my number
                </Button>
              )}
            </div>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="0803 123 4567"
              className="font-mono tracking-wide"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => onPhone(e.target.value)}
              aria-invalid={fieldState.invalid}
            />
            {detected && network && detected !== network && (
              <FieldDescription>
                This number looks like {getNetwork(detected)?.name}. Ported numbers are fine — just double-check the network.
              </FieldDescription>
            )}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={busy}>
      {busy ? (
        <>
          <LoaderCircle className="size-4 animate-spin" /> Preparing summary…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function AirtimeForm({ api, ownPhone }: { api: PaymentFlowApi; ownPhone: string | null }) {
  const form = useForm<AirtimeInput>({
    resolver: zodResolver(airtimeSchema),
    mode: "onTouched",
    defaultValues: { network: undefined as unknown as NetworkId, phone: "", amount: "" },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    applyServerErrors(form, await api.review({ kind: "airtime", input: values }));
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <PhoneField form={form} ownPhone={ownPhone} />
        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="airtime-amount">Amount</FieldLabel>
              <AmountInput id="airtime-amount" size="lg" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
              <AmountPresets presets={AIRTIME_PRESETS_NAIRA} onPick={(v) => field.onChange(v)} current={field.value} />
              <FieldDescription>₦50 – ₦50,000 · no fee</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <SubmitButton busy={api.reviewing}>Continue</SubmitButton>
    </form>
  );
}

const CATEGORIES: { id: DataBundle["category"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "long", label: "Long-term" },
];

function DataForm({ api, ownPhone }: { api: PaymentFlowApi; ownPhone: string | null }) {
  const form = useForm<DataInput>({
    resolver: zodResolver(dataSchema),
    mode: "onTouched",
    defaultValues: { network: undefined as unknown as NetworkId, phone: "", bundleId: "" },
  });
  const [network, bundleId] = useWatch({ control: form.control, name: ["network", "bundleId"] });
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const bundles = useMemo(() => (network ? bundlesForNetwork(network).filter((b) => category === "all" || b.category === category) : []), [network, category]);

  // A bundle from another network is invalid; clear it when the network changes.
  const selected = bundles.find((b) => b.id === bundleId) ?? (network ? bundlesForNetwork(network).find((b) => b.id === bundleId) : undefined);

  const onSubmit = form.handleSubmit(async (values) => {
    applyServerErrors(form, await api.review({ kind: "data", input: values }));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <PhoneField form={form} ownPhone={ownPhone} />
        <Controller
          control={form.control}
          name="bundleId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Data bundle</FieldLabel>
              {!network ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Choose a network to see bundles.</p>
              ) : (
                <>
                  <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="group" aria-label="Bundle duration">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        aria-pressed={category === c.id}
                        className={cn(
                          "h-8 shrink-0 rounded-full px-3 text-[0.8125rem] font-medium transition-[background-color,color,box-shadow,filter] duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          category === c.id
                            ? "bg-brand-gradient text-primary-foreground shadow-glow-sm hover:brightness-110"
                            : "bg-muted text-muted-foreground hover:bg-brand-soft hover:text-foreground",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div role="radiogroup" aria-label="Bundles" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {bundles.map((b) => {
                      const active = field.value === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => field.onChange(b.id)}
                          className={cn(
                            `relative flex flex-col items-start rounded-xl border p-3 text-left ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
                            tileClass(active),
                          )}
                        >
                          {b.popular && <span className="absolute top-2 right-2 rounded-full bg-success-soft px-1.5 text-[0.6rem] font-semibold text-success uppercase">Popular</span>}
                          <span className="text-lg font-semibold tracking-tight">{b.volume}</span>
                          <span className="text-xs text-muted-foreground">{b.validity}</span>
                          <span className="mt-2 text-sm font-medium tabular">{formatNaira(b.price, { trimZeroKobo: true })}</span>
                        </button>
                      );
                    })}
                    {bundles.length === 0 && <p className="col-span-full py-4 text-center text-sm text-muted-foreground">No bundles in this category.</p>}
                  </div>
                </>
              )}
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <SubmitButton busy={api.reviewing}>{selected ? `Continue · ${formatNaira(selected.price, { trimZeroKobo: true })}` : "Continue"}</SubmitButton>
    </form>
  );
}

export function AirtimePanel({ ownPhone }: { ownPhone: string | null }) {
  return (
    <PaymentFlow reviewTitle="Confirm airtime purchase" confirmVerb="Buy airtime ·" successHref="/overview">
      {(api) => <AirtimeForm api={api} ownPhone={ownPhone} />}
    </PaymentFlow>
  );
}

export function DataPanel({ ownPhone }: { ownPhone: string | null }) {
  return (
    <PaymentFlow reviewTitle="Confirm data purchase" confirmVerb="Buy data ·" successHref="/overview">
      {(api) => <DataForm api={api} ownPhone={ownPhone} />}
    </PaymentFlow>
  );
}
