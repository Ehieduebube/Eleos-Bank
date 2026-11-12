"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { BadgeCheck, CircleX, LoaderCircle } from "lucide-react";
import { AmountInput } from "@/components/shared/amount-input";
import { BankDot, BankSelect } from "@/components/shared/bank-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAccountVerification } from "@/hooks/use-account-verification";
import { getBank } from "@/lib/catalog/banks";
import { transferFee } from "@/lib/fees";
import { maskAccountNumber } from "@/lib/format";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type { Beneficiary } from "@/lib/types";
import { transferSchema, type TransferInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-utils";
import { PaymentFlow, type PaymentFlowApi } from "./payment-flow";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

function TransferForm({ api, balance, beneficiaries, initial }: { api: PaymentFlowApi; balance: number; beneficiaries: Beneficiary[]; initial?: Beneficiary }) {
  const form = useForm<TransferInput>({
    resolver: zodResolver(transferSchema),
    mode: "onTouched",
    defaultValues: {
      bankCode: initial?.bankCode ?? "",
      accountNumber: initial?.accountNumber ?? "",
      amount: "",
      narration: "",
      saveBeneficiary: false,
      nickname: "",
    },
  });
  const [bankCode, accountNumber, amount, saveBeneficiary] = useWatch({ control: form.control, name: ["bankCode", "accountNumber", "amount", "saveBeneficiary"] });
  const verification = useAccountVerification(bankCode, accountNumber);
  const { clearErrors } = form;
  useEffect(() => {
    if (verification.status === "ok") clearErrors("accountNumber");
  }, [verification.status, clearErrors]);

  const amountKobo = parseNairaToKobo(amount ?? "");
  const fee = amountKobo && amountKobo > 0 ? transferFee(amountKobo) : null;
  const verified = verification.status === "ok";
  const alreadySaved = verified && verification.savedId !== null;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!verified) {
      form.setError("accountNumber", { message: verification.status === "error" ? verification.message : "Wait for the account name to be verified" });
      return;
    }
    const errors = await api.review({ kind: "transfer", input: { ...values, saveBeneficiary: values.saveBeneficiary && !alreadySaved } });
    applyServerErrors(form, errors);
  });

  const pickBeneficiary = (b: Beneficiary) => {
    form.setValue("bankCode", b.bankCode, { shouldValidate: true });
    form.setValue("accountNumber", b.accountNumber, { shouldValidate: true });
    form.setValue("saveBeneficiary", false);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {beneficiaries.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Send to a saved beneficiary</p>
          <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {beneficiaries.slice(0, 8).map((b) => {
              const active = b.bankCode === bankCode && b.accountNumber === accountNumber;
              return (
                <li key={b.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => pickBeneficiary(b)}
                    aria-pressed={active}
                    className={cn(
                      `flex w-36 flex-col items-start gap-1 rounded-xl border p-3 text-left ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
                      tileClass(active),
                    )}
                  >
                    <BankDot name={getBank(b.bankCode)?.shortName ?? b.bankName} />
                    <span className="w-full truncate text-sm font-medium">{b.nickname ?? b.accountName}</span>
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {getBank(b.bankCode)?.shortName} · {maskAccountNumber(b.accountNumber)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <FieldGroup>
        <Controller
          control={form.control}
          name="bankCode"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bankCode">Destination bank</FieldLabel>
              <BankSelect id="bankCode" value={field.value} onValueChange={field.onChange} invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="accountNumber"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="accountNumber">Account number</FieldLabel>
              <Input
                id="accountNumber"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="10-digit NUBAN"
                className="font-mono tracking-wider"
                {...field}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                aria-invalid={fieldState.invalid}
                aria-describedby="account-verification"
              />
              <div id="account-verification" aria-live="polite" className="min-h-6">
                {verification.status === "loading" && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Verifying account name…
                  </p>
                )}
                {verification.status === "ok" && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
                    <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{verification.name}</span>
                  </p>
                )}
                {verification.status === "error" && !fieldState.error && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <CircleX className="size-4 shrink-0" aria-hidden="true" /> {verification.message}
                  </p>
                )}
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <AmountInput id="amount" size="lg" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid} />
              <FieldDescription className="flex flex-wrap justify-between gap-2">
                <span>Available: {formatNaira(balance)}</span>
                {fee !== null && (
                  <span>
                    Fee {formatNaira(fee)} · Total {formatNaira((amountKobo ?? 0) + fee)}
                  </span>
                )}
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="narration"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="narration">
                Narration <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input id="narration" placeholder="What's this for?" maxLength={60} {...field} aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        {!alreadySaved && (
          <div className="space-y-3 rounded-xl border p-4">
            <Controller
              control={form.control}
              name="saveBeneficiary"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="saveBeneficiary" className="flex-1 font-normal">
                    <span>
                      <span className="block font-medium">Save as beneficiary</span>
                      <span className="block text-xs text-muted-foreground">Find this account faster next time</span>
                    </span>
                  </FieldLabel>
                  <Switch id="saveBeneficiary" checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />
            {saveBeneficiary && (
              <Controller
                control={form.control}
                name="nickname"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="nickname">
                      Nickname <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Input id="nickname" placeholder="e.g. Landlord" maxLength={30} {...field} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}
          </div>
        )}
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={api.reviewing}>
        {api.reviewing ? (
          <>
            <LoaderCircle className="size-4 animate-spin" /> Preparing summary…
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}

export function TransferPanel(props: { balance: number; beneficiaries: Beneficiary[]; initial?: Beneficiary }) {
  return (
    <PaymentFlow reviewTitle="Confirm transfer" confirmVerb="Send" successHref="/overview">
      {(api) => <TransferForm api={api} {...props} />}
    </PaymentFlow>
  );
}
