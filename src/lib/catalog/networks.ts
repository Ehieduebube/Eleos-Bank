/**
 * Mobile networks and ILLUSTRATIVE data bundles.
 * Prices and validity are sample values for the demo; they are not live offers
 * and must be replaced with a provider's product catalogue in a live integration.
 */
export type NetworkId = "mtn" | "airtel" | "glo" | "9mobile";

export interface Network {
  id: NetworkId;
  name: string;
  /** Brand-ish swatch used only for the small network badge. */
  color: string;
  textColor: string;
  prefixes: string[];
}

export const NETWORKS: readonly Network[] = [
  {
    id: "mtn",
    name: "MTN",
    color: "#FFCB05",
    textColor: "#1A1A1A",
    prefixes: ["0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814", "0903", "0906", "0913", "0916", "0704", "07025", "07026"],
  },
  {
    id: "airtel",
    name: "Airtel",
    color: "#E40000",
    textColor: "#FFFFFF",
    prefixes: ["0802", "0808", "0708", "0812", "0701", "0902", "0901", "0904", "0907", "0912", "0911"],
  },
  {
    id: "glo",
    name: "Glo",
    color: "#3BA935",
    textColor: "#FFFFFF",
    prefixes: ["0805", "0807", "0705", "0815", "0811", "0905", "0915"],
  },
  {
    id: "9mobile",
    name: "9mobile",
    color: "#006B3E",
    textColor: "#FFFFFF",
    prefixes: ["0809", "0818", "0817", "0909", "0908"],
  },
] as const;

export const NETWORK_IDS = NETWORKS.map((n) => n.id) as [NetworkId, ...NetworkId[]];

export function getNetwork(id: string): Network | undefined {
  return NETWORKS.find((n) => n.id === id);
}

/** Normalise "+234 803 123 4567" / "2348031234567" / "0803-123-4567" to "08031234567". */
export function normalizeNigerianPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `0${digits}`;
  return digits;
}

export const NIGERIAN_MOBILE_PATTERN = /^0[789][01]\d{8}$/;

/**
 * Best-effort network detection from the number prefix. Mobile number
 * portability means this can be wrong, so the UI always lets the user override.
 */
export function detectNetwork(phone: string): NetworkId | null {
  const normalized = normalizeNigerianPhone(phone);
  if (normalized.length < 4) return null;
  for (const network of NETWORKS) {
    for (const prefix of network.prefixes) {
      if (normalized.startsWith(prefix)) return network.id;
    }
  }
  return null;
}

export const AIRTIME_PRESETS_NAIRA = [100, 200, 500, 1000, 2000, 5000];

export interface DataBundle {
  id: string;
  network: NetworkId;
  name: string;
  volume: string;
  validity: string;
  /** Price in kobo. */
  price: number;
  category: "daily" | "weekly" | "monthly" | "long";
  popular?: boolean;
}

const n = (naira: number) => naira * 100;

export const DATA_BUNDLES: readonly DataBundle[] = [
  // MTN
  { id: "mtn-1gb-1d", network: "mtn", name: "1GB Daily", volume: "1GB", validity: "1 day", price: n(500), category: "daily" },
  { id: "mtn-2.5gb-2d", network: "mtn", name: "2.5GB", volume: "2.5GB", validity: "2 days", price: n(900), category: "daily" },
  { id: "mtn-3.5gb-7d", network: "mtn", name: "3.5GB Weekly", volume: "3.5GB", validity: "7 days", price: n(1500), category: "weekly", popular: true },
  { id: "mtn-7gb-30d", network: "mtn", name: "7GB Monthly", volume: "7GB", validity: "30 days", price: n(3500), category: "monthly", popular: true },
  { id: "mtn-20gb-30d", network: "mtn", name: "20GB Monthly", volume: "20GB", validity: "30 days", price: n(7500), category: "monthly" },
  { id: "mtn-75gb-30d", network: "mtn", name: "75GB Monthly", volume: "75GB", validity: "30 days", price: n(20000), category: "monthly" },
  { id: "mtn-150gb-60d", network: "mtn", name: "150GB", volume: "150GB", validity: "60 days", price: n(40000), category: "long" },
  // Airtel
  { id: "airtel-1gb-1d", network: "airtel", name: "1GB Daily", volume: "1GB", validity: "1 day", price: n(500), category: "daily" },
  { id: "airtel-2gb-2d", network: "airtel", name: "2GB", volume: "2GB", validity: "2 days", price: n(750), category: "daily" },
  { id: "airtel-3gb-7d", network: "airtel", name: "3GB Weekly", volume: "3GB", validity: "7 days", price: n(1500), category: "weekly", popular: true },
  { id: "airtel-8gb-30d", network: "airtel", name: "8GB Monthly", volume: "8GB", validity: "30 days", price: n(3000), category: "monthly", popular: true },
  { id: "airtel-18gb-30d", network: "airtel", name: "18GB Monthly", volume: "18GB", validity: "30 days", price: n(6000), category: "monthly" },
  { id: "airtel-60gb-30d", network: "airtel", name: "60GB Monthly", volume: "60GB", validity: "30 days", price: n(15000), category: "monthly" },
  // Glo
  { id: "glo-1.5gb-1d", network: "glo", name: "1.5GB Daily", volume: "1.5GB", validity: "1 day", price: n(500), category: "daily" },
  { id: "glo-3.9gb-7d", network: "glo", name: "3.9GB Weekly", volume: "3.9GB", validity: "7 days", price: n(1500), category: "weekly", popular: true },
  { id: "glo-10gb-30d", network: "glo", name: "10GB Monthly", volume: "10GB", validity: "30 days", price: n(3000), category: "monthly", popular: true },
  { id: "glo-26gb-30d", network: "glo", name: "26GB Monthly", volume: "26GB", validity: "30 days", price: n(7500), category: "monthly" },
  { id: "glo-107gb-30d", network: "glo", name: "107GB Monthly", volume: "107GB", validity: "30 days", price: n(20000), category: "monthly" },
  // 9mobile
  { id: "9m-1gb-1d", network: "9mobile", name: "1GB Daily", volume: "1GB", validity: "1 day", price: n(400), category: "daily" },
  { id: "9m-2.5gb-7d", network: "9mobile", name: "2.5GB Weekly", volume: "2.5GB", validity: "7 days", price: n(1200), category: "weekly" },
  { id: "9m-7gb-30d", network: "9mobile", name: "7GB Monthly", volume: "7GB", validity: "30 days", price: n(3000), category: "monthly", popular: true },
  { id: "9m-15gb-30d", network: "9mobile", name: "15GB Monthly", volume: "15GB", validity: "30 days", price: n(6000), category: "monthly" },
];

export function getBundle(id: string): DataBundle | undefined {
  return DATA_BUNDLES.find((b) => b.id === id);
}

export function bundlesForNetwork(network: NetworkId): DataBundle[] {
  return DATA_BUNDLES.filter((b) => b.network === network);
}
