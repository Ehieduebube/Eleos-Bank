"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateProfileAction } from "@/actions/settings";
import { applyServerErrors } from "@/components/payments/form-utils";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Account, Profile } from "@/lib/types";
import { profileSchema, type ProfileInput } from "@/lib/validation";

export function ProfileForm({ profile, account, dataMode }: { profile: Profile; account: Account; dataMode: "local" | "supabase" }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile.fullName, email: profile.email, phone: profile.phone ?? "" },
  });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (!result.ok) {
        if (!applyServerErrors(form, result.error.fieldErrors ?? null)) toast.error(result.error.message);
        return;
      }
      toast.success(result.data.message);
      form.reset(values);
    }),
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>Used on receipts and to personalise your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <FieldGroup>
              <Controller
                control={form.control}
                name="fullName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                    <Input id="fullName" autoComplete="name" {...field} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email address</FieldLabel>
                    <Input id="email" type="email" autoComplete="email" {...field} aria-invalid={fieldState.invalid} />
                    {dataMode === "supabase" && <FieldDescription>Changing your email sends a confirmation link to the new address.</FieldDescription>}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                    <Input id="phone" type="tel" autoComplete="tel-national" placeholder="0803 123 4567" {...field} aria-invalid={fieldState.invalid} />
                    <FieldDescription>Used for &ldquo;Use my number&rdquo; when buying airtime or data.</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !form.formState.isDirty}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card size="sm" className="h-fit">
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Share these to receive money</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Account number</dt>
              <dd className="flex items-center gap-1 font-mono font-medium">
                {account.accountNumber} <CopyButton value={account.accountNumber} label="Copy account number" />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account name</dt>
              <dd className="font-medium">{account.accountName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="font-medium">{account.bankName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">Nigerian naira (NGN)</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
