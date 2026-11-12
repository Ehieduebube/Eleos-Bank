/**
 * Display formatting helpers. Dates render in West Africa Time (Africa/Lagos).
 *
 * Lagos is a fixed UTC+1 offset with no daylight saving, so dates are formatted
 * arithmetically instead of with Intl. That keeps server-rendered and
 * browser-hydrated output byte-identical (ICU versions differ between Node and
 * browsers, e.g. in the spaces they put before "AM"/"PM").
 */

export const APP_TIME_ZONE = "Africa/Lagos";
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const pad = (n: number) => n.toString().padStart(2, "0");

/** Calendar parts of an instant in Lagos time. */
export function lagosParts(date: Date | string) {
  const shifted = new Date((typeof date === "string" ? new Date(date) : date).getTime() + LAGOS_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export function formatDate(iso: string): string {
  const p = lagosParts(iso);
  return `${p.day} ${MONTH_SHORT[p.month]} ${p.year}`;
}

export function formatTime(iso: string): string {
  const p = lagosParts(iso);
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${hour12}:${pad(p.minute)} ${p.hour < 12 ? "AM" : "PM"}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** YYYY-MM-DD in Lagos time; used for grouping and date filters. */
export function lagosDayKey(date: Date | string): string {
  const p = lagosParts(date);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

/** YYYY-MM in Lagos time. */
export function lagosMonthKey(date: Date | string): string {
  return lagosDayKey(date).slice(0, 7);
}

/** "Today", "Yesterday" or a date, for grouped lists. */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const key = lagosDayKey(iso);
  if (key === lagosDayKey(now)) return "Today";
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === lagosDayKey(yesterday)) return "Yesterday";
  return formatDate(iso);
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

/** "0123456789" -> "******6789" style masking used everywhere account numbers are listed. */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `${"•".repeat(Math.min(6, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}

/** "08031234567" -> "0803 *** 4567" */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 4)} *** ${phone.slice(-4)}`;
}

/** "08031234567" -> "0803 123 4567" */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 11) return phone;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

export function maskIdentifier(value: string): string {
  if (value.length <= 5) return value;
  return `${value.slice(0, 2)}${"•".repeat(Math.min(5, value.length - 5))}${value.slice(-3)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Group a 20-digit meter token as 4-digit blocks. */
export function formatToken(token: string): string {
  return token.replace(/(\d{4})(?=\d)/g, "$1-");
}

export function greeting(now: Date = new Date()): string {
  const { hour } = lagosParts(now);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** ISO timestamp for N days before now (server-side window calculations). */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function isInFuture(iso: string | null | undefined, now: Date = new Date()): boolean {
  return !!iso && new Date(iso).getTime() > now.getTime();
}
