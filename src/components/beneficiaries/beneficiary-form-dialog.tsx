"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BadgeCheck, CircleX, LoaderCircle } from "lucide-react";
import { createBeneficiaryAction, updateBeneficiaryAction } from "@/actions/beneficiaries";
import { applyServerErrors } from "@/components/payments/form-utils";
import { BankSelect } from "@/components/shared/bank-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAccountVerification } from "@/hooks/use-account-verification";
import type { Beneficiary } from "@/lib/types";
import { beneficiarySchema, type BeneficiaryInput } from "@/lib/validation";

function BeneficiaryForm({ beneficiary, onDone }: { beneficiary: Beneficiary | null; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<BeneficiaryInput>({
    resolver: zodResolver(beneficiarySchema),
    mode: "onTouched",
    defaultValues: {
      bankCode: beneficiary?.bankCode ?? "",
      accountNumber: beneficiary?.accountNumber ?? "",
      nickname: beneficiary?.nickname ?? "",
    },
  });
  const [bankCode, accountNumber] = useWatch({ control: form.control, name: ["bankCode", "accountNumber"] });
  const verification = useAccountVerification(bankCode, accountNumber);
  const duplicate = verification.status === "ok" && verification.savedId !== null && verification.savedId !== beneficiary?.id;

  const onSubmit = form.handleSubmit((values) => {
    if (verification.status !== "ok") {
      form.setError("accountNumber", { message: verification.status === "error" ? verification.message : "Wait for the account name to be verified" });
      return;
    }
    startTransition(async () => {
      const result = beneficiary ? await updateBeneficiaryAction(beneficiary.id, values) : await createBeneficiaryAction(values);
      if (!result.ok) {
        if (!applyServerErrors(form, result.error.fieldErrors ?? null)) toast.error(result.error.message);
        return;
      }
      toast.success(beneficiary ? "Beneficiary updated" : `${result.data.accountName} saved`);
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FieldGroup>
        <Controller
          control={form.control}
          name="bankCode"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="b-bank">Bank</FieldLabel>
              <BankSelect id="b-bank" value={field.value} onValueChange={field.onChange} invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="accountNumber"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="b-account">Account number</FieldLabel>
              <Input
                id="b-account"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit NUBAN"
                className="font-mono tracking-wider"
                {...field}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                aria-invalid={fieldState.invalid}
              />
              <div aria-live="polite" className="min-h-6">
                {verification.status === "loading" && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Verifying…
                  </p>
                )}
                {verification.status === "ok" && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
                    <BadgeCheck className="size-4" aria-hidden="true" /> {verification.name}
                  </p>
                )}
                {verification.status === "error" && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <CircleX className="size-4" aria-hidden="true" /> {verification.message}
                  </p>
                )}
                {duplicate && <p className="mt-1 text-sm text-warning">This account is already in your beneficiaries.</p>}
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="nickname"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="b-nickname">
                Nickname <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input id="b-nickname" placeholder="e.g. Mum, Landlord" maxLength={30} {...field} aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || duplicate}>
          {pending ? "Saving…" : beneficiary ? "Save changes" : "Save beneficiary"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BeneficiaryFormDialog({ open, onOpenChange, beneficiary }: { open: boolean; onOpenChange: (open: boolean) => void; beneficiary: Beneficiary | null }) {
  const [formKey, setFormKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((k) => k + 1);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{beneficiary ? "Edit beneficiary" : "Add beneficiary"}</DialogTitle>
          <DialogDescription>We verify the account name before saving.</DialogDescription>
        </DialogHeader>
        {open && <BeneficiaryForm key={`${beneficiary?.id ?? "new"}-${formKey}`} beneficiary={beneficiary} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
