import { z } from "zod";
import { isKnownBank } from "./catalog/banks";
import { NETWORK_IDS, NIGERIAN_MOBILE_PATTERN, getBundle, normalizeNigerianPhone } from "./catalog/networks";
import { getCablePlan, getCableProvider, getDisco, getInternetPlan, getInternetProvider, getUtilityBiller } from "./catalog/billers";
import { getBettingProvider } from "./catalog/betting";
import { getMerchant } from "./catalog/merchants";
import { LIMITS, type AmountLimits } from "./fees";
import { formatNaira, parseNairaToKobo } from "./money";

/**
 * Validation schemas shared by forms (client) and server actions (server).
 * Form values stay as strings; the server converts amounts to kobo with
 * `parseNairaToKobo` after the same schema has accepted them.
 */

export function amountField(limits: AmountLimits) {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        ctx.addIssue({ code: "custom", message: "Enter an amount" });
        return;
      }
      if (/^-/.test(value)) {
        ctx.addIssue({ code: "custom", message: "Amount cannot be negative" });
        return;
      }
      const kobo = parseNairaToKobo(value);
      if (kobo === null) {
        ctx.addIssue({ code: "custom", message: "Enter a valid naira amount (max 2 decimal places)" });
        return;
      }
      if (kobo <= 0) {
        ctx.addIssue({ code: "custom", message: "Amount must be greater than zero" });
        return;
      }
      if (kobo < limits.min) {
        ctx.addIssue({ code: "custom", message: `Minimum amount is ${formatNaira(limits.min, { trimZeroKobo: true })}` });
        return;
      }
      if (kobo > limits.max) {
        ctx.addIssue({ code: "custom", message: `Maximum amount is ${formatNaira(limits.max, { trimZeroKobo: true })}` });
      }
    });
}

export const nubanField = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Account number must be exactly 10 digits");

export const phoneField = z
  .string()
  .trim()
  .transform((v) => normalizeNigerianPhone(v))
  .pipe(z.string().regex(NIGERIAN_MOBILE_PATTERN, "Enter a valid Nigerian mobile number, e.g. 0803 123 4567"));

export const bankCodeField = z
  .string()
  .min(1, "Select a bank")
  .refine(isKnownBank, "Select a bank from the list");

export const narrationField = z
  .string()
  .trim()
  .max(60, "Keep the narration under 60 characters")
  .regex(/^[\w\s.,'&()\-/#:]*$/, "Narration contains unsupported characters");

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const transferSchema = z.object({
  bankCode: bankCodeField,
  accountNumber: nubanField,
  amount: amountField(LIMITS.transfer),
  narration: narrationField,
  saveBeneficiary: z.boolean(),
  nickname: z.string().trim().max(30, "Nickname must be 30 characters or fewer"),
});
export type TransferInput = z.input<typeof transferSchema>;

export const airtimeSchema = z.object({
  network: z.enum(NETWORK_IDS, { error: "Select a network" }),
  phone: phoneField,
  amount: amountField(LIMITS.airtime),
});
export type AirtimeInput = z.input<typeof airtimeSchema>;

export const dataSchema = z
  .object({
    network: z.enum(NETWORK_IDS, { error: "Select a network" }),
    phone: phoneField,
    bundleId: z.string().min(1, "Choose a data bundle"),
  })
  .superRefine((value, ctx) => {
    const bundle = getBundle(value.bundleId);
    if (!bundle || bundle.network !== value.network) {
      ctx.addIssue({ code: "custom", path: ["bundleId"], message: "Choose a bundle for the selected network" });
    }
  });
export type DataInput = z.input<typeof dataSchema>;

export const electricitySchema = z.object({
  discoId: z.string().min(1, "Select your electricity provider").refine((id) => !!getDisco(id), "Select a provider from the list"),
  meterType: z.enum(["prepaid", "postpaid"], { error: "Choose prepaid or postpaid" }),
  meterNumber: z
    .string()
    .trim()
    .regex(/^\d{11,13}$/, "Meter number must be 11 to 13 digits"),
  amount: amountField(LIMITS.electricity),
});
export type ElectricityInput = z.input<typeof electricitySchema>;

function identifierField(label: string) {
  return z.string().trim().min(1, `Enter your ${label.toLowerCase()}`);
}

export const cableSchema = z
  .object({
    providerId: z.string().min(1, "Select a provider"),
    smartcardNumber: identifierField("smartcard number"),
    planId: z.string().min(1, "Choose a subscription plan"),
  })
  .superRefine((value, ctx) => {
    const provider = getCableProvider(value.providerId);
    if (!provider) {
      ctx.addIssue({ code: "custom", path: ["providerId"], message: "Select a provider from the list" });
      return;
    }
    if (!new RegExp(provider.identifierPattern).test(value.smartcardNumber)) {
      ctx.addIssue({ code: "custom", path: ["smartcardNumber"], message: `${provider.identifierLabel} must be 10 or 11 digits` });
    }
    const plan = getCablePlan(value.planId);
    if (!plan || plan.providerId !== provider.id) {
      ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose a plan for the selected provider" });
    }
  });
export type CableInput = z.input<typeof cableSchema>;

export const internetSchema = z
  .object({
    providerId: z.string().min(1, "Select a provider"),
    customerId: identifierField("customer ID"),
    planId: z.string().min(1, "Choose a plan"),
  })
  .superRefine((value, ctx) => {
    const provider = getInternetProvider(value.providerId);
    if (!provider) {
      ctx.addIssue({ code: "custom", path: ["providerId"], message: "Select a provider from the list" });
      return;
    }
    if (!new RegExp(provider.identifierPattern).test(value.customerId)) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: `${provider.identifierLabel} must be 6–20 letters or digits` });
    }
    const plan = getInternetPlan(value.planId);
    if (!plan || plan.providerId !== provider.id) {
      ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose a plan for the selected provider" });
    }
  });
export type InternetInput = z.input<typeof internetSchema>;

export const utilitySchema = z
  .object({
    billerId: z.string().min(1, "Select a biller"),
    customerId: identifierField("customer reference"),
    amount: amountField(LIMITS.utility),
  })
  .superRefine((value, ctx) => {
    const biller = getUtilityBiller(value.billerId);
    if (!biller) {
      ctx.addIssue({ code: "custom", path: ["billerId"], message: "Select a biller from the list" });
      return;
    }
    if (!new RegExp(biller.identifierPattern).test(value.customerId)) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: `${biller.identifierLabel} must be 6–20 characters` });
    }
  });
export type UtilityInput = z.input<typeof utilitySchema>;

export const bettingSchema = z.object({
  providerId: z
    .string()
    .min(1, "Select a betting platform")
    .refine((id) => getBettingProvider(id)?.enabled === true, "This platform is not available"),
  customerId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]{4,20}$/, "Customer ID must be 4–20 letters, digits, dots or dashes"),
  amount: amountField(LIMITS.betting),
});
export type BettingInput = z.input<typeof bettingSchema>;

export const creditSchema = z.object({
  amount: amountField(LIMITS.credit),
  source: z.enum(["salary", "transfer", "refund", "topup"]),
});
export type CreditInput = z.input<typeof creditSchema>;

export const cardPurchaseSchema = z.object({
  merchantId: z.string().refine((id) => !!getMerchant(id), "Choose a merchant"),
  amount: amountField(LIMITS.card),
});
export type CardPurchaseInput = z.input<typeof cardPurchaseSchema>;

/** Discriminated payment request, validated identically on client and server. */
export const paymentRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("transfer"), input: transferSchema }),
  z.object({ kind: z.literal("airtime"), input: airtimeSchema }),
  z.object({ kind: z.literal("data"), input: dataSchema }),
  z.object({ kind: z.literal("electricity"), input: electricitySchema }),
  z.object({ kind: z.literal("cable_tv"), input: cableSchema }),
  z.object({ kind: z.literal("internet"), input: internetSchema }),
  z.object({ kind: z.literal("utility"), input: utilitySchema }),
  z.object({ kind: z.literal("betting"), input: bettingSchema }),
]);
export type PaymentRequestInput = z.input<typeof paymentRequestSchema>;
export type PaymentRequest = z.output<typeof paymentRequestSchema>;
export type PaymentKind = PaymentRequest["kind"];

export const executionEnvelopeSchema = z.object({
  idempotencyKey: z.uuid("Invalid submission key"),
  /** The total the user saw and confirmed; execution is refused if the server's total differs. */
  confirmedTotal: z.number().int().nonnegative(),
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be 4 digits")
    .optional(),
});
export type ExecutionEnvelope = z.infer<typeof executionEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Beneficiaries, profile and security
// ---------------------------------------------------------------------------

export const beneficiarySchema = z.object({
  bankCode: bankCodeField,
  accountNumber: nubanField,
  nickname: z.string().trim().max(30, "Nickname must be 30 characters or fewer"),
});
export type BeneficiaryInput = z.input<typeof beneficiarySchema>;

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Enter your full name")
    .max(80, "Name is too long")
    .regex(/^[\p{L}\s.'-]+$/u, "Name can only contain letters, spaces, apostrophes and hyphens"),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  phone: z.union([z.literal(""), phoneField]),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

const WEAK_PINS = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "1212", "0123"]);

export const pinSchema = z
  .object({
    currentPin: z.string(),
    pin: z
      .string()
      .regex(/^\d{4}$/, "PIN must be exactly 4 digits")
      .refine((p) => !WEAK_PINS.has(p), "This PIN is too easy to guess"),
    confirmPin: z.string(),
  })
  .refine((v) => v.pin === v.confirmPin, { path: ["confirmPin"], message: "PINs do not match" });
export type PinInput = z.input<typeof pinSchema>;

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  hideBalance: z.boolean().optional(),
  emailAlerts: z.boolean().optional(),
  smsAlerts: z.boolean().optional(),
  pushAlerts: z.boolean().optional(),
  lowBalanceAlert: z.boolean().optional(),
  lowBalanceThreshold: z.number().int().min(0).max(100_000_000_00).optional(),
  marketingEmails: z.boolean().optional(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const cardLimitsSchema = z
  .object({
    dailyLimit: amountField({ min: 1_000_00, max: 5_000_000_00 }),
    monthlyLimit: amountField({ min: 1_000_00, max: 20_000_000_00 }),
  })
  .refine((v) => (parseNairaToKobo(v.dailyLimit) ?? 0) <= (parseNairaToKobo(v.monthlyLimit) ?? 0), {
    path: ["monthlyLimit"],
    message: "Monthly limit must be at least the daily limit",
  });
export type CardLimitsInput = z.input<typeof cardLimitsSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});
export type SignInInput = z.input<typeof signInSchema>;

export const signUpSchema = z
  .object({
    fullName: profileSchema.shape.fullName,
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type SignUpInput = z.input<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

/** Flatten a ZodError into { field: firstMessage } for form display. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => typeof p === "string" || typeof p === "number").join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
