import { AirtimeSkeleton } from "./airtime-skeleton";
import { BeneficiariesSkeleton } from "./beneficiaries-skeleton";
import { BettingSkeleton } from "./betting-skeleton";
import { BillsSkeleton } from "./bills-skeleton";
import { CardsSkeleton } from "./cards-skeleton";
import { OverviewSkeleton } from "./overview-skeleton";
import { SettingsSkeleton } from "./settings-skeleton";
import { TransactionsSkeleton } from "./transactions-skeleton";
import { TransferSkeleton } from "./transfer-skeleton";

const ROUTES_WITH_SKELETONS = new Set(["/overview", "/transfer", "/airtime", "/bills", "/betting", "/transactions", "/beneficiaries", "/cards", "/settings"]);

export function hasRouteSkeleton(pathname: string) {
  return ROUTES_WITH_SKELETONS.has(pathname);
}

/**
 * An app page's loading skeleton, laid out like the page itself. Shown while an in-app
 * navigation to the page is in flight (see components/layout/route-transition.tsx).
 *
 * These are deliberately not `loading.tsx` files: Next.js streams a `loading.tsx` ahead of the
 * page on every full load too, so a browser refresh painted the skeleton (scrolled to the top,
 * because it is shorter than the page) before the page itself.
 */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  switch (pathname) {
    case "/overview":
      return <OverviewSkeleton />;
    case "/transfer":
      return <TransferSkeleton />;
    case "/airtime":
      return <AirtimeSkeleton />;
    case "/bills":
      return <BillsSkeleton />;
    case "/betting":
      return <BettingSkeleton />;
    case "/transactions":
      return <TransactionsSkeleton />;
    case "/beneficiaries":
      return <BeneficiariesSkeleton />;
    case "/cards":
      return <CardsSkeleton />;
    case "/settings":
      return <SettingsSkeleton />;
    default:
      return null;
  }
}
