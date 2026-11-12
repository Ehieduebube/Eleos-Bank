"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import type { ThemePreference } from "@/lib/types";

/** Apply the theme saved in the user's profile once per page load. */
export function ThemeSync({ preferred }: { preferred: ThemePreference }) {
  const { theme, setTheme } = useTheme();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || theme === undefined) return;
    applied.current = true;
    if (theme !== preferred) setTheme(preferred);
  }, [theme, preferred, setTheme]);
  return null;
}
