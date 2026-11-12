import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BalanceVisibilityProvider } from "@/components/layout/balance-visibility";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ThemeSync } from "@/components/layout/theme-sync";
import { UserMenu } from "@/components/layout/user-menu";
import { getViewer } from "@/server/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const notifications = await viewer.repo.listNotifications(viewer.user.id, 15);

  return (
    <BalanceVisibilityProvider initialHidden={viewer.preferences.hideBalance}>
      <ThemeSync preferred={viewer.preferences.theme} />
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <AppSidebar fullName={viewer.profile.fullName} email={viewer.profile.email} />
      {/* Gentle ambient brand light at the top of the canvas; purely decorative. */}
      <div className="bg-ambient-brand pointer-events-none fixed inset-x-0 top-0 -z-10 h-[26rem] lg:left-64" aria-hidden="true" />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/overview" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden" aria-label="Eleos home">
              <Logo />
            </Link>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <NotificationsMenu notifications={notifications} />
              <UserMenu fullName={viewer.profile.fullName} email={viewer.profile.email} />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileNav />
    </BalanceVisibilityProvider>
  );
}
