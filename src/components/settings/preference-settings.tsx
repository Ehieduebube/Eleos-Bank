"use client";

import { useTheme } from "next-themes";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { updatePreferencesAction } from "@/actions/settings";
import { AmountInput } from "@/components/shared/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { formatNaira, koboToInputString, parseNairaToKobo } from "@/lib/money";
import type { ThemePreference, UserPreferences } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

type BoolKey = "emailAlerts" | "smsAlerts" | "pushAlerts" | "lowBalanceAlert" | "marketingEmails" | "hideBalance";

function usePreferences(initial: UserPreferences) {
  const [, startTransition] = useTransition();
  const [prefs, setOptimistic] = useOptimistic(initial, (state, patch: Partial<UserPreferences>) => ({ ...state, ...patch }));
  const save = (patch: Partial<UserPreferences>, message = "Preferences saved") =>
    startTransition(async () => {
      setOptimistic(patch);
      const result = await updatePreferencesAction(patch);
      if (result.ok) toast.success(message);
      else toast.error(result.error.message);
    });
  return { prefs, save };
}

function SwitchRow({ id, title, description, checked, onChange }: { id: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function NotificationSettings({ preferences }: { preferences: UserPreferences }) {
  const { prefs, save } = usePreferences(preferences);
  const [threshold, setThreshold] = useState(koboToInputString(preferences.lowBalanceThreshold));
  const toggle = (key: BoolKey) => (value: boolean) => save({ [key]: value });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>Choose how you hear about account activity. In-app notifications are always on.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/70 py-0">
          <SwitchRow id="emailAlerts" title="Email alerts" description="Debit and credit alerts by email" checked={prefs.emailAlerts} onChange={toggle("emailAlerts")} />
          <SwitchRow id="smsAlerts" title="SMS alerts" description="Transaction alerts by text message" checked={prefs.smsAlerts} onChange={toggle("smsAlerts")} />
          <SwitchRow id="pushAlerts" title="Push notifications" description="Instant alerts on this device" checked={prefs.pushAlerts} onChange={toggle("pushAlerts")} />
          <SwitchRow id="marketingEmails" title="Product news" description="Occasional updates about new features" checked={prefs.marketingEmails} onChange={toggle("marketingEmails")} />
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Low balance alert</CardTitle>
            <CardDescription>Get an in-app alert when a payment takes you below this amount.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SwitchRow id="lowBalanceAlert" title="Enabled" description={`Currently ${formatNaira(prefs.lowBalanceThreshold, { trimZeroKobo: true })}`} checked={prefs.lowBalanceAlert} onChange={toggle("lowBalanceAlert")} />
            <div className="flex gap-2">
              <AmountInput value={threshold} onValueChange={setThreshold} aria-label="Low balance threshold" disabled={!prefs.lowBalanceAlert} />
              <Button
                variant="outline"
                className="h-10"
                disabled={!prefs.lowBalanceAlert}
                onClick={() => {
                  const kobo = parseNairaToKobo(threshold);
                  if (kobo === null) return void toast.error("Enter a valid amount");
                  save({ lowBalanceThreshold: kobo }, "Threshold updated");
                }}
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function AppearanceSettings({ preferences }: { preferences: UserPreferences }) {
  const { setTheme } = useTheme();
  const { prefs, save } = usePreferences(preferences);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Light is the default. Your choice is saved to your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={prefs.theme === t.value}
                onClick={() => {
                  setTheme(t.value);
                  save({ theme: t.value }, `Theme set to ${t.label.toLowerCase()}`);
                }}
                className={cn(
                  `flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
                  tileClass(prefs.theme === t.value),
                )}
              >
                <t.icon className="size-5" aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>Control what shows on screen.</CardDescription>
        </CardHeader>
        <CardContent className="py-0">
          <SwitchRow
            id="hideBalance"
            title="Hide balances by default"
            description="Mask amounts until you tap the eye icon. Useful in public."
            checked={prefs.hideBalance}
            onChange={(v) => {
              save({ hideBalance: v });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
