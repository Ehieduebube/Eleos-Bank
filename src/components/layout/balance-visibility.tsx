"use client";

import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { updatePreferencesAction } from "@/actions/settings";

interface BalanceVisibility {
  hidden: boolean;
  toggle: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibility>({ hidden: false, toggle: () => undefined });

/** Shared show/hide-balance state, persisted to the user's preferences. */
export function BalanceVisibilityProvider({ initialHidden, children }: { initialHidden: boolean; children: ReactNode }) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();
  const toggle = useCallback(() => {
    const next = !hidden;
    setHidden(next);
    startTransition(async () => {
      await updatePreferencesAction({ hideBalance: next });
    });
  }, [hidden]);
  return <BalanceVisibilityContext value={{ hidden, toggle }}>{children}</BalanceVisibilityContext>;
}

export function useBalanceVisibility() {
  return useContext(BalanceVisibilityContext);
}
