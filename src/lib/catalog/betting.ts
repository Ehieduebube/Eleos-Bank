/**
 * Betting wallet providers available for (simulated) wallet funding.
 * Each provider can be switched off here; a live integration must also confirm
 * that the payment partner actually supports the provider before enabling it.
 */
export interface BettingProvider {
  id: string;
  name: string;
  identifierLabel: string;
  identifierHint: string;
  /** Hex used for the small provider mark. */
  color: string;
  enabled: boolean;
}

export const BETTING_PROVIDERS: readonly BettingProvider[] = [
  { id: "sportybet", name: "SportyBet", identifierLabel: "SportyBet user ID / phone", identifierHint: "The phone number or user ID on your SportyBet account", color: "#E41827", enabled: true },
  { id: "bet9ja", name: "Bet9ja", identifierLabel: "Bet9ja customer ID", identifierHint: "Your Bet9ja account ID", color: "#0B8A3E", enabled: true },
  { id: "betking", name: "BetKing", identifierLabel: "BetKing user ID", identifierHint: "Your BetKing username or ID", color: "#1B2A6B", enabled: true },
  { id: "1xbet", name: "1xBet", identifierLabel: "1xBet account ID", identifierHint: "Numeric account ID from your 1xBet profile", color: "#1A5DAB", enabled: true },
  { id: "msport", name: "MSport", identifierLabel: "MSport phone / ID", identifierHint: "Phone number registered on MSport", color: "#F5B800", enabled: true },
  { id: "nairabet", name: "NairaBet", identifierLabel: "NairaBet customer ID", identifierHint: "Your NairaBet customer ID", color: "#C8102E", enabled: true },
  { id: "betway", name: "Betway", identifierLabel: "Betway user ID / phone", identifierHint: "Phone number registered on Betway", color: "#111111", enabled: true },
];

export function getBettingProvider(id: string): BettingProvider | undefined {
  return BETTING_PROVIDERS.find((p) => p.id === id);
}

export function enabledBettingProviders(): BettingProvider[] {
  return BETTING_PROVIDERS.filter((p) => p.enabled);
}

export const BETTING_PRESETS_NAIRA = [500, 1000, 2000, 5000, 10000];
