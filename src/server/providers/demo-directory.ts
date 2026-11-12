/**
 * Fictional account holders known to the DEMO verification provider.
 * None of these are real people or real account numbers.
 */
export interface DirectoryEntry {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export const DEMO_DIRECTORY: readonly DirectoryEntry[] = [
  { bankCode: "058", accountNumber: "0214587793", accountName: "AMAKA CHIOMA OBI" },
  { bankCode: "044", accountNumber: "0692284415", accountName: "CHINEDU EMEKA EZE" },
  { bankCode: "011", accountNumber: "3089915526", accountName: "NGOZI FOLAKE ADEYEMI" },
  { bankCode: "057", accountNumber: "2207718840", accountName: "BAYO OLUWASEUN OGUNLEYE" },
  { bankCode: "033", accountNumber: "2154409983", accountName: "IFEOMA GRACE NWOSU" },
  { bankCode: "999992", accountNumber: "8123456780", accountName: "SEUN BAKARE" },
  { bankCode: "070", accountNumber: "6311204578", accountName: "KELECHI DAVID OKAFOR" },
  { bankCode: "50515", accountNumber: "5003318842", accountName: "HALIMA BELLO MUSA" },
];

const FIRST_NAMES = [
  "ADEBAYO", "CHIAMAKA", "OLUWASEUN", "IFEANYI", "FATIMA", "EMEKA", "TEMITOPE", "AISHA", "OLUMIDE", "NNEKA",
  "YUSUF", "BUKOLA", "UCHENNA", "ZAINAB", "TUNDE", "CHIDINMA", "IBRAHIM", "FUNMILAYO", "OBINNA", "HAUWA",
];
const MIDDLE_NAMES = ["", "GRACE", "DAVID", "BLESSING", "SAMUEL", "JOY", "PETER", "MARY", "JOHN", "FAITH"];
const LAST_NAMES = [
  "OKONKWO", "ADEYEMI", "BELLO", "NWACHUKWU", "OGUNDIPE", "ABUBAKAR", "EZE", "ADEBAYO", "OKORO", "MOHAMMED",
  "AFOLABI", "CHUKWU", "OYELARAN", "IBRAHIM", "NNAMDI", "BALOGUN", "UMEH", "LAWAL", "OKAFOR", "DANJUMA",
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic, clearly simulated account name for an unknown account number. */
export function simulatedAccountName(bankCode: string, accountNumber: string): string {
  const h = hash(`${bankCode}:${accountNumber}`);
  const first = FIRST_NAMES[h % FIRST_NAMES.length]!;
  const middle = MIDDLE_NAMES[(h >>> 5) % MIDDLE_NAMES.length]!;
  const last = LAST_NAMES[(h >>> 10) % LAST_NAMES.length]!;
  return [first, middle, last].filter(Boolean).join(" ");
}

export function simulatedCustomerName(seed: string): string {
  const h = hash(seed);
  return `${FIRST_NAMES[h % FIRST_NAMES.length]} ${LAST_NAMES[(h >>> 7) % LAST_NAMES.length]}`;
}

export function stableHash(value: string): number {
  return hash(value);
}
