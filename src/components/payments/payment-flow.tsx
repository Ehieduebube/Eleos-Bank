"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, CircleCheck, CircleX, Clock, KeyRound, LoaderCircle, Lock, Printer, RefreshCw, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import { executePaymentAction, quotePaymentAction, refreshTransactionStatusAction, type PaymentOutcome, type QuoteView } from "@/actions/payments";
import { SummaryList, TokenPanel } from "@/components/transactions/transaction-detail-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { initials } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { counterpartyRows, resultHeadline } from "@/lib/receipt";
import type { Transaction } from "@/lib/types";
import type { PaymentRequestInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

export interface PaymentFlowApi {
  /** Get a server-side quote and move to the confirmation step. Resolves with field errors to show on the form. */
  review: (request: PaymentRequestInput) => Promise<Record<string, string> | null>;
  reviewing: boolean;
}

type Step = "form" | "review" | "result";

export function PaymentFlow({
  children,
  reviewTitle,
  confirmVerb = "Pay",
  successHref = "/overview",
}: {
  children: (api: PaymentFlowApi) => ReactNode;
  reviewTitle: string;
  confirmVerb?: string;
  successHref?: string;
}) {
  const [step, setStep] = useState<Step>("form");
  const [formKey, setFormKey] = useState(0);
  const [request, setRequest] = useState<PaymentRequestInput | null>(null);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const containerId = useId();

  const scrollTop = useCallback(() => document.getElementById(containerId)?.scrollIntoView({ behavior: "smooth", block: "start" }), [containerId]);

  const review = useCallback(async (next: PaymentRequestInput) => {
    setReviewing(true);
    try {
      const result = await quotePaymentAction(next);
      if (!result.ok) {
        if (!result.error.fieldErrors || result.error.code !== "VALIDATION") toast.error(result.error.message);
        return result.error.fieldErrors ?? null;
      }
      setRequest(next);
      setQuote(result.data);
      setStep("review");
      scrollTop();
      return null;
    } catch {
      toast.error("We couldn't reach the server. Check your connection and try again.");
      return null;
    } finally {
      setReviewing(false);
    }
  }, [scrollTop]);

  const backToForm = () => {
    setStep("form");
    setQuote(null);
    scrollTop();
  };

  const startOver = () => {
    setStep("form");
    setQuote(null);
    setOutcome(null);
    setRequest(null);
    setFormKey((k) => k + 1);
    scrollTop();
  };

  return (
    <div id={containerId} className="scroll-mt-24">
      <div hidden={step !== "form"}>
        <div key={formKey}>{children({ review, reviewing })}</div>
      </div>
      {step === "review" && quote && request && (
        <ConfirmStep
          title={reviewTitle}
          verb={confirmVerb}
          quote={quote}
          request={request}
          onBack={backToForm}
          onResult={(result) => {
            setOutcome(result);
            setStep("result");
            scrollTop();
          }}
          onQuoteInvalid={backToForm}
        />
      )}
      {step === "result" && outcome && <ResultStep outcome={outcome} onAnother={startOver} doneHref={successHref} />}
    </div>
  );
}

function ConfirmStep({
  title,
  verb,
  quote,
  request,
  onBack,
  onResult,
  onQuoteInvalid,
}: {
  title: string;
  verb: string;
  quote: QuoteView;
  request: PaymentRequestInput;
  onBack: () => void;
  onResult: (outcome: PaymentOutcome) => void;
  onQuoteInvalid: () => void;
}) {
  // One submission key per confirmation screen: retries after a network error reuse it,
  // so the server returns the original result instead of charging twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [requiresPin, setRequiresPin] = useState(quote.requiresPin);
  const balanceAfter = quote.availableBalance - quote.total;

  const confirm = () => {
    if (submitting.current) return; // guards against double clicks before React re-renders
    if (requiresPin && pin.length !== 4) {
      setPinError("Enter your 4-digit PIN");
      return;
    }
    submitting.current = true;
    setPinError(null);
    startTransition(async () => {
      try {
        const result = await executePaymentAction(request, { idempotencyKey, confirmedTotal: quote.total, ...(requiresPin ? { pin } : {}) });
        if (result.ok) {
          onResult(result.data);
          return;
        }
        const { code, message } = result.error;
        if (code === "PIN_INVALID") {
          setPinError(message);
          setPin("");
        } else if (code === "PIN_REQUIRED") {
          setRequiresPin(true);
          setPinError(message);
        } else if (["QUOTE_CHANGED", "INSUFFICIENT_FUNDS", "VALIDATION", "VERIFICATION_FAILED", "IDEMPOTENCY_CONFLICT"].includes(code)) {
          toast.error(message);
          onQuoteInvalid();
        } else {
          toast.error(message);
        }
      } catch {
        toast.error("Connection problem. Tap confirm again — you won't be charged twice.");
      } finally {
        submitting.current = false;
      }
    });
  };

  return (
    <div className="space-y-5" aria-live="polite">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={pending}>
          <ArrowLeft className="size-4" /> Edit details
        </Button>
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">Check everything carefully before you confirm.</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border bg-surface-sunken p-4">
        <Avatar className="size-11">
          <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials(quote.recipientTitle)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold">{quote.recipientTitle}</p>
          <p className="truncate text-sm text-muted-foreground">{quote.recipientSubtitle}</p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">You are paying</p>
        <p className="mt-1 text-[2rem] leading-none font-semibold tracking-tight tabular">{formatNaira(quote.amount)}</p>
      </div>

      <SummaryList
        rows={[
          ...quote.rows,
          { label: "Amount", value: formatNaira(quote.amount) },
          { label: "Fee", value: quote.fee > 0 ? formatNaira(quote.fee) : "Free" },
          { label: "Total to be debited", value: formatNaira(quote.total), emphasis: true },
          { label: "Balance after", value: formatNaira(balanceAfter) },
        ]}
      />

      {requiresPin ? (
        <div className="space-y-2 rounded-xl border p-4">
          <label htmlFor="txn-pin" className="flex items-center gap-1.5 text-sm font-medium">
            <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> Transaction PIN
          </label>
          <InputOTP
            id="txn-pin"
            maxLength={4}
            value={pin}
            onChange={(v) => {
              setPin(v.replace(/\D/g, ""));
              setPinError(null);
            }}
            inputMode="numeric"
            pattern="^[0-9]*$"
            aria-invalid={!!pinError}
            aria-describedby={pinError ? "txn-pin-error" : undefined}
            disabled={pending}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => (
                <InputOTPSlot key={i} index={i} className="[-webkit-text-security:disc]" aria-invalid={!!pinError} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {pinError && (
            <p id="txn-pin-error" role="alert" className="text-sm text-destructive">
              {pinError}
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Tip: <Link href="/settings?tab=security" className="font-medium text-brand-vivid hover:underline">set a transaction PIN</Link> to require it on every payment.
          </span>
        </p>
      )}

      <Button type="button" size="lg" className="w-full" onClick={confirm} disabled={pending} aria-busy={pending}>
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" /> Processing securely…
          </>
        ) : (
          <>
            <ShieldCheck className="size-4" /> {verb} {formatNaira(quote.total)}
          </>
        )}
      </Button>
    </div>
  );
}

const RESULT_STYLE = {
  successful: { Icon: CircleCheck, ring: "bg-success-soft text-success" },
  pending: { Icon: Clock, ring: "bg-warning-soft text-warning" },
  failed: { Icon: CircleX, ring: "bg-danger-soft text-destructive" },
  reversed: { Icon: Undo2, ring: "bg-brand-soft text-brand-vivid" },
} as const;

function ResultStep({ outcome, onAnother, doneHref }: { outcome: PaymentOutcome; onAnother: () => void; doneHref: string }) {
  const [txn, setTxn] = useState<Transaction>(outcome.transaction);
  const [checking, startTransition] = useTransition();
  const { Icon, ring } = RESULT_STYLE[txn.status];

  const checkStatus = () =>
    startTransition(async () => {
      const result = await refreshTransactionStatusAction(txn.id);
      if (!result.ok) return void toast.error(result.error.message);
      setTxn(result.data);
      if (result.data.status === "pending") toast.info("Still awaiting provider confirmation. Try again in a few seconds.");
    });

  return (
    <div className="space-y-5 text-center" aria-live="polite">
      <div className="flex flex-col items-center gap-3 pt-2">
        <span className={cn("flex size-16 items-center justify-center rounded-full animate-in zoom-in-50 duration-300", ring)}>
          <Icon className="size-8" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{resultHeadline(txn)}</h2>
        <p className="text-[1.75rem] leading-none font-semibold tracking-tight tabular">{formatNaira(txn.total)}</p>
        <p className="text-sm text-muted-foreground">{txn.description}</p>
      </div>

      {txn.status === "failed" && txn.failureReason && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-left text-sm text-destructive">
          {txn.failureReason} Your balance was not reduced.
        </p>
      )}
      {txn.status === "pending" && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-left text-sm">
          The provider hasn&apos;t confirmed this payment yet. The amount is held and will be returned automatically if it fails. Check again in a few seconds.
        </p>
      )}
      {typeof txn.details.token === "string" && <TokenPanel token={txn.details.token} units={txn.details.units as string | undefined} />}

      <div className="rounded-xl border p-4 text-left">
        <SummaryList
          rows={[
            ...counterpartyRows(txn),
            { label: "Fee", value: txn.fee > 0 ? formatNaira(txn.fee) : "Free" },
            { label: "Reference", value: txn.reference, mono: true },
            { label: "New balance", value: formatNaira(outcome.balance), emphasis: true },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" size="lg">
          <Link href={`/receipt/${txn.id}`} target="_blank" rel="noopener">
            <Printer className="size-4" /> View receipt
          </Link>
        </Button>
        {txn.status === "pending" ? (
          <Button variant="outline" size="lg" onClick={checkStatus} disabled={checking}>
            <RefreshCw className={cn("size-4", checking && "animate-spin")} /> {checking ? "Checking…" : "Check status"}
          </Button>
        ) : (
          <Button variant="outline" size="lg" onClick={onAnother}>
            <RotateCcw className="size-4" /> {txn.status === "failed" ? "Try again" : "Make another"}
          </Button>
        )}
        <Button asChild size="lg" className="sm:col-span-2">
          <Link href={doneHref}>Done</Link>
        </Button>
      </div>
    </div>
  );
}
