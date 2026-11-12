/**
 * Bill-payment catalogue: electricity distribution companies, cable TV,
 * internet and other utilities. Plans and prices are ILLUSTRATIVE demo values,
 * not live offers.
 */

const n = (naira: number) => naira * 100;

export interface Disco {
  id: string;
  name: string;
  shortName: string;
  region: string;
  /** Illustrative tariff (kobo per kWh) used to compute simulated units. */
  tariffPerKwh: number;
}

export const DISCOS: readonly Disco[] = [
  { id: "ikedc", name: "Ikeja Electric", shortName: "IKEDC", region: "Lagos (Ikeja)", tariffPerKwh: n(209.5) },
  { id: "ekedc", name: "Eko Electricity", shortName: "EKEDC", region: "Lagos (Eko)", tariffPerKwh: n(209.5) },
  { id: "aedc", name: "Abuja Electricity", shortName: "AEDC", region: "FCT, Niger, Kogi, Nasarawa", tariffPerKwh: n(209.5) },
  { id: "ibedc", name: "Ibadan Electricity", shortName: "IBEDC", region: "Oyo, Ogun, Osun, Kwara", tariffPerKwh: n(209.5) },
  { id: "eedc", name: "Enugu Electricity", shortName: "EEDC", region: "South East", tariffPerKwh: n(209.5) },
  { id: "phed", name: "Port Harcourt Electricity", shortName: "PHED", region: "Rivers, Bayelsa, Cross River, Akwa Ibom", tariffPerKwh: n(209.5) },
  { id: "bedc", name: "Benin Electricity", shortName: "BEDC", region: "Edo, Delta, Ondo, Ekiti", tariffPerKwh: n(209.5) },
  { id: "kedco", name: "Kano Electricity", shortName: "KEDCO", region: "Kano, Jigawa, Katsina", tariffPerKwh: n(209.5) },
  { id: "kaedco", name: "Kaduna Electric", shortName: "KAEDCO", region: "Kaduna, Kebbi, Sokoto, Zamfara", tariffPerKwh: n(209.5) },
  { id: "jed", name: "Jos Electricity", shortName: "JED", region: "Plateau, Bauchi, Benue, Gombe", tariffPerKwh: n(209.5) },
  { id: "yedc", name: "Yola Electricity", shortName: "YEDC", region: "Adamawa, Borno, Taraba, Yobe", tariffPerKwh: n(209.5) },
  { id: "aba", name: "Aba Power", shortName: "Aba Power", region: "Aba ring-fenced area", tariffPerKwh: n(209.5) },
];

export const ELECTRICITY_PRESETS_NAIRA = [2000, 5000, 10000, 20000, 50000];

export interface PlanProvider {
  id: string;
  name: string;
  /** Label for the customer identifier this biller uses. */
  identifierLabel: string;
  identifierHint: string;
  identifierPattern: string;
}

export interface BillPlan {
  id: string;
  providerId: string;
  name: string;
  price: number;
  validity: string;
  description?: string;
}

export const CABLE_PROVIDERS: readonly PlanProvider[] = [
  { id: "dstv", name: "DStv", identifierLabel: "Smartcard number", identifierHint: "10-digit number on your decoder", identifierPattern: "^\\d{10,11}$" },
  { id: "gotv", name: "GOtv", identifierLabel: "IUC number", identifierHint: "10-digit IUC number on your decoder", identifierPattern: "^\\d{10,11}$" },
  { id: "startimes", name: "StarTimes", identifierLabel: "Smartcard number", identifierHint: "11-digit smartcard number", identifierPattern: "^\\d{10,11}$" },
];

export const CABLE_PLANS: readonly BillPlan[] = [
  { id: "dstv-padi", providerId: "dstv", name: "DStv Padi", price: n(4400), validity: "1 month" },
  { id: "dstv-yanga", providerId: "dstv", name: "DStv Yanga", price: n(6000), validity: "1 month" },
  { id: "dstv-confam", providerId: "dstv", name: "DStv Confam", price: n(11000), validity: "1 month" },
  { id: "dstv-compact", providerId: "dstv", name: "DStv Compact", price: n(19000), validity: "1 month" },
  { id: "dstv-compact-plus", providerId: "dstv", name: "DStv Compact Plus", price: n(30000), validity: "1 month" },
  { id: "dstv-premium", providerId: "dstv", name: "DStv Premium", price: n(44500), validity: "1 month" },
  { id: "gotv-smallie", providerId: "gotv", name: "GOtv Smallie", price: n(1900), validity: "1 month" },
  { id: "gotv-jinja", providerId: "gotv", name: "GOtv Jinja", price: n(3900), validity: "1 month" },
  { id: "gotv-jolli", providerId: "gotv", name: "GOtv Jolli", price: n(5800), validity: "1 month" },
  { id: "gotv-max", providerId: "gotv", name: "GOtv Max", price: n(8500), validity: "1 month" },
  { id: "gotv-supa", providerId: "gotv", name: "GOtv Supa", price: n(11400), validity: "1 month" },
  { id: "gotv-supa-plus", providerId: "gotv", name: "GOtv Supa+", price: n(16800), validity: "1 month" },
  { id: "st-nova", providerId: "startimes", name: "StarTimes Nova", price: n(2100), validity: "1 month" },
  { id: "st-basic", providerId: "startimes", name: "StarTimes Basic", price: n(4000), validity: "1 month" },
  { id: "st-smart", providerId: "startimes", name: "StarTimes Smart", price: n(5100), validity: "1 month" },
  { id: "st-classic", providerId: "startimes", name: "StarTimes Classic", price: n(6000), validity: "1 month" },
  { id: "st-super", providerId: "startimes", name: "StarTimes Super", price: n(9800), validity: "1 month" },
];

export const INTERNET_PROVIDERS: readonly PlanProvider[] = [
  { id: "spectranet", name: "Spectranet", identifierLabel: "Customer ID", identifierHint: "Your Spectranet customer/user ID", identifierPattern: "^[A-Za-z0-9]{6,20}$" },
  { id: "smile", name: "Smile", identifierLabel: "Smile account ID", identifierHint: "Your 10-digit Smile account number", identifierPattern: "^[A-Za-z0-9]{6,20}$" },
  { id: "ipnx", name: "ipNX", identifierLabel: "Customer ID", identifierHint: "Your ipNX customer ID", identifierPattern: "^[A-Za-z0-9]{6,20}$" },
];

export const INTERNET_PLANS: readonly BillPlan[] = [
  { id: "spec-35gb", providerId: "spectranet", name: "Spectranet 35GB", price: n(10000), validity: "30 days" },
  { id: "spec-100gb", providerId: "spectranet", name: "Spectranet 100GB", price: n(18000), validity: "30 days" },
  { id: "spec-unl", providerId: "spectranet", name: "Spectranet Unlimited", price: n(23000), validity: "30 days" },
  { id: "smile-20gb", providerId: "smile", name: "Smile 20GB", price: n(8000), validity: "30 days" },
  { id: "smile-unl-lite", providerId: "smile", name: "Smile Unlimited Lite", price: n(15000), validity: "30 days" },
  { id: "smile-unl", providerId: "smile", name: "Smile Unlimited Premium", price: n(25000), validity: "30 days" },
  { id: "ipnx-home-basic", providerId: "ipnx", name: "ipNX Home Basic (10Mbps)", price: n(18500), validity: "30 days" },
  { id: "ipnx-home-plus", providerId: "ipnx", name: "ipNX Home Plus (25Mbps)", price: n(30000), validity: "30 days" },
];

export const UTILITY_BILLERS: readonly PlanProvider[] = [
  { id: "lwc", name: "Lagos Water Corporation", identifierLabel: "Customer account number", identifierHint: "Account number on your water bill", identifierPattern: "^[A-Za-z0-9-]{6,20}$" },
  { id: "lawma", name: "LAWMA (Waste)", identifierLabel: "Customer reference", identifierHint: "Reference on your PSP waste bill", identifierPattern: "^[A-Za-z0-9-]{6,20}$" },
  { id: "fctwb", name: "FCT Water Board", identifierLabel: "Customer account number", identifierHint: "Account number on your water bill", identifierPattern: "^[A-Za-z0-9-]{6,20}$" },
];

export function getDisco(id: string) {
  return DISCOS.find((d) => d.id === id);
}
export function getCableProvider(id: string) {
  return CABLE_PROVIDERS.find((p) => p.id === id);
}
export function getCablePlan(id: string) {
  return CABLE_PLANS.find((p) => p.id === id);
}
export function getInternetProvider(id: string) {
  return INTERNET_PROVIDERS.find((p) => p.id === id);
}
export function getInternetPlan(id: string) {
  return INTERNET_PLANS.find((p) => p.id === id);
}
export function getUtilityBiller(id: string) {
  return UTILITY_BILLERS.find((p) => p.id === id);
}
