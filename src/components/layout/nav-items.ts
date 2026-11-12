import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  Settings,
  Smartphone,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { href: "/airtime", label: "Airtime & Data", icon: Smartphone },
  { href: "/bills", label: "Bills", icon: ReceiptText },
  { href: "/betting", label: "Betting", icon: Trophy },
  { href: "/transactions", label: "Transactions", icon: ScrollText },
  { href: "/beneficiaries", label: "Beneficiaries", icon: Users },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** The most important destinations for the mobile bottom bar (the rest live under "More"). */
export const MOBILE_PRIMARY = ["/overview", "/transfer", "/bills", "/transactions"];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
