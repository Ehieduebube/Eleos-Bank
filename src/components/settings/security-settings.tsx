"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { KeyRound, Laptop, LogOut, Smartphone } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { changePasswordAction, revokeSessionAction, setTransactionPinAction, signOutOtherSessionsAction } from "@/actions/settings";
import { applyServerErrors } from "@/components/payments/form-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { SecurityStatus, SessionInfo } from "@/lib/types";
import { changePasswordSchema, pinSchema, type ChangePasswordInput, type PinInput } from "@/lib/validation";

function PasswordCard({ canChange, reason }: { canChange: boolean; reason?: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        if (!applyServerErrors(form, result.error.fieldErrors ?? null)) toast.error(result.error.message);
        return;
      }
      toast.success("Password changed. Other sessions were signed out.");
      form.reset();
    }),
  );
  const fields: { name: keyof ChangePasswordInput; label: string; autoComplete: string; hint?: string }[] = [
    { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
    { name: "newPassword", label: "New password", autoComplete: "new-password", hint: "At least 8 characters with a letter and a number." },
    { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>{canChange ? "Change the password you use to sign in." : reason}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FieldGroup>
            {fields.map((f) => (
              <Controller
                key={f.name}
                control={form.control}
                name={f.name}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
                    <Input id={f.name} type="password" autoComplete={f.autoComplete} disabled={!canChange} {...field} aria-invalid={fieldState.invalid} />
                    {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canChange || pending}>
              {pending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PinSlots({ value, onChange, id, invalid, disabled }: { value: string; onChange: (v: string) => void; id: string; invalid: boolean; disabled?: boolean }) {
  return (
    <InputOTP id={id} maxLength={4} value={value} onChange={(v) => onChange(v.replace(/\D/g, ""))} inputMode="numeric" pattern="^[0-9]*$" disabled={disabled} aria-invalid={invalid}>
      <InputOTPGroup>
        {[0, 1, 2, 3].map((i) => (
          <InputOTPSlot key={i} index={i} className="[-webkit-text-security:disc]" aria-invalid={invalid} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

function PinCard({ security, locked, canSet, reason }: { security: SecurityStatus; locked: boolean; canSet: boolean; reason?: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<PinInput>({ resolver: zodResolver(pinSchema), defaultValues: { currentPin: "", pin: "", confirmPin: "" } });
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (security.hasPin && values.currentPin.length !== 4) {
        form.setError("currentPin", { message: "Enter your current PIN" });
        return;
      }
      const result = await setTransactionPinAction(values);
      if (!result.ok) {
        if (!applyServerErrors(form, result.error.fieldErrors ?? null)) toast.error(result.error.message);
        return;
      }
      toast.success(security.hasPin ? "Transaction PIN changed" : "Transaction PIN set — it's now required for payments");
      form.reset();
    }),
  );
  const slots: { name: keyof PinInput; label: string }[] = [
    ...(security.hasPin ? [{ name: "currentPin" as const, label: "Current PIN" }] : []),
    { name: "pin", label: security.hasPin ? "New PIN" : "Choose a PIN" },
    { name: "confirmPin", label: "Confirm PIN" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" /> Transaction PIN
        </CardTitle>
        <CardDescription>
          {!canSet
            ? reason
            : security.hasPin
              ? `Required to confirm every payment.${security.pinUpdatedAt ? ` Last changed ${formatDateTime(security.pinUpdatedAt)}.` : ""}`
              : "Add a 4-digit PIN to confirm transfers and payments. It is stored only as a salted hash."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {locked && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">PIN locked after too many attempts. Try again after {formatDateTime(security.pinLockedUntil!)}.</p>}
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {slots.map((s) => (
              <Controller
                key={s.name}
                control={form.control}
                name={s.name}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={s.name}>{s.label}</FieldLabel>
                    <PinSlots id={s.name} value={field.value} onChange={field.onChange} invalid={fieldState.invalid} disabled={locked || !canSet} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || locked || !canSet}>
              {pending ? "Saving…" : security.hasPin ? "Change PIN" : "Set PIN"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function describeAgent(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Unknown device", mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile };
}

function SessionsCard({ sessions, dataMode }: { sessions: SessionInfo[] | null; dataMode: "local" | "supabase" }) {
  const [pending, startTransition] = useTransition();
  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeSessionAction(id);
      if (result.ok) toast.success("Session signed out");
      else toast.error(result.error.message);
    });
  const revokeOthers = () =>
    startTransition(async () => {
      const result = await signOutOtherSessionsAction();
      if (result.ok) toast.success(result.data.message);
      else toast.error(result.error.message);
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions ? (
          <ul className="divide-y divide-border/70">
            {sessions.map((s) => {
              const agent = describeAgent(s.userAgent);
              const Icon = agent.mobile ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand-vivid">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {agent.label} {s.current && <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] text-success">This device</span>}
                    </p>
                    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                      Signed in {timeAgo(s.createdAt)} · expires {formatDateTime(s.expiresAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(s.id)} disabled={pending}>
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {dataMode === "supabase" ? "Sessions are managed by Supabase Auth. You can sign out every other device below." : "No session information available."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={revokeOthers} disabled={pending}>
            Sign out other sessions
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="destructive">
              <LogOut className="size-4" /> Sign out
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecuritySettings({
  security,
  pinLocked,
  sessions,
  dataMode,
  canChangePassword,
  passwordReason,
  canSetPin,
  pinReason,
}: {
  security: SecurityStatus;
  pinLocked: boolean;
  sessions: SessionInfo[] | null;
  dataMode: "local" | "supabase";
  canChangePassword: boolean;
  passwordReason?: string;
  canSetPin: boolean;
  pinReason?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <PinCard security={security} locked={pinLocked} canSet={canSetPin} reason={pinReason} />
        <SessionsCard sessions={sessions} dataMode={dataMode} />
      </div>
      <PasswordCard canChange={canChangePassword} reason={passwordReason} />
    </div>
  );
}
