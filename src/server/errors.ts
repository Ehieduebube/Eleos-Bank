import type { ActionError, ActionErrorCode } from "@/lib/types";

/** An expected, user-presentable failure. Anything else is treated as internal. */
export class AppError extends Error {
  readonly code: ActionErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ActionErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  toActionError(): ActionError {
    return { code: this.code, message: this.message, ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}) };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const Errors = {
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again."),
  notFound: (what: string) => new AppError("NOT_FOUND", `${what} was not found.`),
  forbidden: () => new AppError("FORBIDDEN", "You do not have access to this resource."),
  insufficientFunds: () => new AppError("INSUFFICIENT_FUNDS", "Insufficient balance for this transaction, including fees."),
  idempotencyConflict: () =>
    new AppError("IDEMPOTENCY_CONFLICT", "This submission key was already used for a different payment. Please start again."),
  quoteChanged: () => new AppError("QUOTE_CHANGED", "The amount or fee changed since you reviewed it. Please review again."),
  notConfigured: (message: string) => new AppError("NOT_CONFIGURED", message),
};
