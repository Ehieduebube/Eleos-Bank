"use client";

import { useEffect, useRef, useState } from "react";
import { verifyAccountAction } from "@/actions/payments";

export type AccountVerification =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; name: string; savedId: string | null }
  | { status: "error"; message: string };

type Settled = { key: string } & ({ status: "ok"; name: string; savedId: string | null } | { status: "error"; message: string });

/**
 * Resolve the account holder's name once a bank and a full 10-digit number are
 * present (debounced; stale responses are ignored). The name shown here is for
 * the user's confidence only — the server resolves it again before any payment.
 */
export function useAccountVerification(bankCode: string, accountNumber: string): AccountVerification {
  const key = `${bankCode}:${accountNumber}`;
  const ready = !!bankCode && /^\d{10}$/.test(accountNumber);
  const [settled, setSettled] = useState<Settled | null>(null);
  const latest = useRef(key);

  useEffect(() => {
    latest.current = key;
    if (!ready) return;
    const timer = setTimeout(async () => {
      try {
        const result = await verifyAccountAction({ bankCode, accountNumber });
        if (latest.current !== key) return;
        setSettled(
          result.ok
            ? { key, status: "ok", name: result.data.accountName, savedId: result.data.savedBeneficiaryId }
            : { key, status: "error", message: result.error.message },
        );
      } catch {
        if (latest.current === key) setSettled({ key, status: "error", message: "Couldn't verify the account. Check your connection." });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [key, ready, bankCode, accountNumber]);

  if (!ready) return { status: "idle" };
  if (!settled || settled.key !== key) return { status: "loading" };
  return settled.status === "ok" ? { status: "ok", name: settled.name, savedId: settled.savedId } : { status: "error", message: settled.message };
}
