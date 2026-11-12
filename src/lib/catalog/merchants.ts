/** Fictional merchants used for simulated virtual-card purchases. */
export interface DemoMerchant {
  id: string;
  name: string;
  category: string;
  /** Typical amount in kobo, used for the seeded history. */
  typical: number;
}

export const DEMO_MERCHANTS: readonly DemoMerchant[] = [
  { id: "netflix", name: "Netflix", category: "Streaming", typical: 700_000 },
  { id: "spotify", name: "Spotify", category: "Streaming", typical: 190_000 },
  { id: "jumia", name: "Jumia", category: "Shopping", typical: 2_450_000 },
  { id: "bolt", name: "Bolt", category: "Transport", typical: 350_000 },
  { id: "uber", name: "Uber", category: "Transport", typical: 420_000 },
  { id: "chowdeck", name: "Chowdeck", category: "Food", typical: 650_000 },
  { id: "konga", name: "Konga", category: "Shopping", typical: 1_800_000 },
  { id: "apple", name: "Apple Services", category: "Subscriptions", typical: 150_000 },
  { id: "google", name: "Google Workspace", category: "Subscriptions", typical: 1_000_000 },
];

export function getMerchant(id: string): DemoMerchant | undefined {
  return DEMO_MERCHANTS.find((m) => m.id === id);
}
