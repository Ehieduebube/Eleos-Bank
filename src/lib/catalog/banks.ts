/**
 * Nigerian banks and licensed financial institutions offered in the transfer
 * flow. Codes are the commonly published CBN/NIP institution codes and are used
 * here for display and routing in demo mode only; a live integration must load
 * the provider's own bank list (e.g. a /bank endpoint) and use its codes.
 */
export interface Bank {
  code: string;
  name: string;
  shortName: string;
  type: "commercial" | "microfinance" | "fintech" | "non-interest" | "merchant";
}

export const BANKS: readonly Bank[] = [
  { code: "044", name: "Access Bank", shortName: "Access", type: "commercial" },
  { code: "023", name: "Citibank Nigeria", shortName: "Citibank", type: "commercial" },
  { code: "050", name: "Ecobank Nigeria", shortName: "Ecobank", type: "commercial" },
  { code: "070", name: "Fidelity Bank", shortName: "Fidelity", type: "commercial" },
  { code: "011", name: "First Bank of Nigeria", shortName: "FirstBank", type: "commercial" },
  { code: "214", name: "First City Monument Bank", shortName: "FCMB", type: "commercial" },
  { code: "103", name: "Globus Bank", shortName: "Globus", type: "commercial" },
  { code: "058", name: "Guaranty Trust Bank", shortName: "GTBank", type: "commercial" },
  { code: "301", name: "Jaiz Bank", shortName: "Jaiz", type: "non-interest" },
  { code: "082", name: "Keystone Bank", shortName: "Keystone", type: "commercial" },
  { code: "50211", name: "Kuda Microfinance Bank", shortName: "Kuda", type: "microfinance" },
  { code: "303", name: "Lotus Bank", shortName: "Lotus", type: "non-interest" },
  { code: "50515", name: "Moniepoint Microfinance Bank", shortName: "Moniepoint", type: "microfinance" },
  { code: "999992", name: "OPay", shortName: "OPay", type: "fintech" },
  { code: "107", name: "Optimus Bank", shortName: "Optimus", type: "commercial" },
  { code: "999991", name: "PalmPay", shortName: "PalmPay", type: "fintech" },
  { code: "104", name: "Parallex Bank", shortName: "Parallex", type: "commercial" },
  { code: "076", name: "Polaris Bank", shortName: "Polaris", type: "commercial" },
  { code: "105", name: "PremiumTrust Bank", shortName: "PremiumTrust", type: "commercial" },
  { code: "101", name: "Providus Bank", shortName: "Providus", type: "commercial" },
  { code: "106", name: "Signature Bank", shortName: "Signature", type: "commercial" },
  { code: "221", name: "Stanbic IBTC Bank", shortName: "Stanbic IBTC", type: "commercial" },
  { code: "068", name: "Standard Chartered Bank", shortName: "StanChart", type: "commercial" },
  { code: "232", name: "Sterling Bank", shortName: "Sterling", type: "commercial" },
  { code: "100", name: "SunTrust Bank", shortName: "SunTrust", type: "commercial" },
  { code: "302", name: "TAJBank", shortName: "TAJBank", type: "non-interest" },
  { code: "102", name: "Titan Trust Bank", shortName: "Titan Trust", type: "commercial" },
  { code: "032", name: "Union Bank of Nigeria", shortName: "Union Bank", type: "commercial" },
  { code: "033", name: "United Bank for Africa", shortName: "UBA", type: "commercial" },
  { code: "215", name: "Unity Bank", shortName: "Unity", type: "commercial" },
  { code: "566", name: "VFD Microfinance Bank", shortName: "VFD", type: "microfinance" },
  { code: "035", name: "Wema Bank", shortName: "Wema", type: "commercial" },
  { code: "057", name: "Zenith Bank", shortName: "Zenith", type: "commercial" },
] as const;

/** Banks surfaced first in the selector. */
export const POPULAR_BANK_CODES = ["058", "044", "033", "057", "011", "070", "999992", "50515"];

const BANK_INDEX = new Map(BANKS.map((bank) => [bank.code, bank]));

export function getBank(code: string): Bank | undefined {
  return BANK_INDEX.get(code);
}

export function isKnownBank(code: string): boolean {
  return BANK_INDEX.has(code);
}
