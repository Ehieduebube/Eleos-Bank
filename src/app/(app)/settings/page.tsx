import type { Metadata } from "next";
import { Bell, Palette, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import { DemoDataSettings } from "@/components/settings/demo-data-settings";
import { AppearanceSettings, NotificationSettings } from "@/components/settings/preference-settings";
import { ProfileForm } from "@/components/settings/profile-form";
import { SecuritySettings } from "@/components/settings/security-settings";
import { isInFuture } from "@/lib/format";
import { listLocalSessions } from "@/server/auth/local-auth";
import { getRuntimeInfo } from "@/server/config";
import { getViewer } from "@/server/context";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile, account, preferences, security } = await getViewer();
  const runtime = getRuntimeInfo();
  const sessions = runtime.dataMode === "local" ? await listLocalSessions(user.id) : null;

  // The demo account is shared by every visitor, so its password and PIN are fixed.
  const shared = user.isDemoUser;
  const passwordReason = shared ? "The demo account is shared, so its password can't be changed. Create your own account to try this." : undefined;
  const pinReason = shared ? "The demo account is shared, so it can't have a PIN. Create your own account to set one." : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, security and preferences." />
      <UrlTabs
        defaultValue="profile"
        tabs={[
          { value: "profile", label: <><UserRound className="size-4" /> Profile</>, content: <ProfileForm profile={profile} account={account} dataMode={runtime.dataMode} /> },
          {
            value: "security",
            label: <><ShieldCheck className="size-4" /> Security</>,
            content: <SecuritySettings security={security} pinLocked={isInFuture(security.pinLockedUntil)} sessions={sessions} dataMode={runtime.dataMode} canChangePassword={!shared} passwordReason={passwordReason} canSetPin={!shared} pinReason={pinReason} />,
          },
          { value: "notifications", label: <><Bell className="size-4" /> Notifications</>, content: <NotificationSettings preferences={preferences} /> },
          { value: "appearance", label: <><Palette className="size-4" /> Appearance</>, content: <AppearanceSettings preferences={preferences} /> },
          { value: "data", label: <><RotateCcw className="size-4" /> Reset</>, content: <DemoDataSettings sharedDemoProfile={user.isDemoUser} /> },
        ]}
      />
    </div>
  );
}
