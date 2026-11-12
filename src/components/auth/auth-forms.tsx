"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm, type Path, type UseFormReturn, type FieldValues } from "react-hook-form";
import { toast } from "sonner";
import { Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/actions/auth";
import { applyServerErrors } from "@/components/payments/form-utils";
import { Notice } from "@/components/shared/notice";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/types";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation";

function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  description,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: React.ReactNode;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  description?: string;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <div className="relative">
            <Input
              id={name}
              type={isPassword && visible ? "text" : type}
              autoComplete={autoComplete}
              placeholder={placeholder}
              className={isPassword ? "pr-10" : undefined}
              {...field}
              value={field.value ?? ""}
              aria-invalid={fieldState.invalid}
            />
            {isPassword && (
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={visible ? "Hide password" : "Show password"}
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

/** Run an auth action; on success the server redirects, so we only handle failures. */
function useAuthSubmit<T extends FieldValues, R>(form: UseFormReturn<T>, action: (values: T) => Promise<ActionResult<R> | undefined>, onSuccess?: (data: R) => void) {
  const [pending, startTransition] = useTransition();
  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await action(values);
      if (!result) return;
      if (!result.ok) {
        if (!applyServerErrors(form, result.error.fieldErrors ?? null)) toast.error(result.error.message);
        return;
      }
      onSuccess?.(result.data);
    }),
  );
  return { pending, submit };
}

export function SignInForm({ next }: { next?: string }) {
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { pending, submit } = useAuthSubmit(form, (values) => signInAction(values, next));
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FieldGroup>
        <TextField form={form} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
        <TextField
          form={form}
          name="password"
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link href="/forgot-password" className="text-xs font-medium text-brand-vivid hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          type="password"
          autoComplete="current-password"
        />
      </FieldGroup>
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [confirmEmail, setConfirmEmail] = useState(false);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });
  const { pending, submit } = useAuthSubmit(form, signUpAction, (data) => {
    if (data.needsEmailConfirmation) setConfirmEmail(true);
  });

  if (confirmEmail) {
    return (
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">We sent a confirmation link to {form.getValues("email")}. Open it to activate your account.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FieldGroup>
        <TextField form={form} name="fullName" label="Full name" autoComplete="name" placeholder="Adaeze Okafor" />
        <TextField form={form} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
        <TextField form={form} name="password" label="Password" type="password" autoComplete="new-password" description="At least 8 characters with a letter and a number." />
        <TextField form={form} name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
      </FieldGroup>
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm({ localMode }: { localMode: boolean }) {
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { pending, submit } = useAuthSubmit(form, forgotPasswordAction, (data) => setSent(data.message));

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">{sent}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {localMode && (
        <Notice>
          Password reset emails aren&apos;t available on this server yet. Create a new account instead.
        </Notice>
      )}
      <FieldGroup>
        <TextField form={form} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
      </FieldGroup>
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const { pending, submit } = useAuthSubmit(form, resetPasswordAction);
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FieldGroup>
        <TextField form={form} name="password" label="New password" type="password" autoComplete="new-password" description="At least 8 characters with a letter and a number." />
        <TextField form={form} name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
      </FieldGroup>
      <SubmitButton pending={pending}>Update password</SubmitButton>
    </form>
  );
}
