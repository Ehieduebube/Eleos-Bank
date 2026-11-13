"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Held at full opacity at least this long, counted from when it first paints. */
const MIN_VISIBLE_MS = 2000;
/** Matches `duration-500` on the fade-out below. */
const FADE_MS = 500;
/**
 * The page has hydrated by the time this counts down, so it is usable; this only
 * stops a stalled request (one that holds back the `load` event) from keeping the
 * splash up indefinitely.
 */
const MAX_LOAD_WAIT_MS = 8000;

/** Routes that open in their own tab as documents (the printable receipt): no splash. */
const NO_SPLASH_PREFIXES = ["/receipt/"];

type Phase = "shown" | "leaving" | "gone";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Resolves once the whole streamed document, and everything it loads, has arrived. */
function documentLoaded() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

/**
 * Full-screen brand splash shown while Eleos first loads (a new tab or a full reload).
 *
 * It is server-rendered into the first HTML, so it paints before the page beneath it.
 * It lives in the root layout, which persists across client-side navigation, so it never
 * replays when moving between pages, signing in or signing out.
 */
export function SplashScreen() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>(() =>
    NO_SPLASH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ? "gone" : "shown",
  );

  useEffect(() => {
    if (phase === "leaving") {
      const timer = window.setTimeout(() => setPhase("gone"), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "shown") return;

    // This effect runs once React has hydrated the page: the app is interactive. Before
    // fading, also wait out the minimum display time and the rest of the document (on a
    // full load of the dashboard, its data streams in after the first HTML).
    let cancelled = false;
    // No paint entry yet (or no Paint Timing support): count from now, so the minimum is never cut short.
    const firstPaint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? performance.now();
    const minimumShown = wait(Math.max(0, firstPaint + MIN_VISIBLE_MS - performance.now()));
    const pageLoaded = Promise.all([documentLoaded(), document.fonts?.ready]);
    Promise.all([minimumShown, Promise.race([pageLoaded, wait(MAX_LOAD_WAIT_MS)])]).then(() => {
      if (!cancelled) setPhase("leaving");
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <>
      <div
        data-splash=""
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[100] flex touch-none items-center justify-center overflow-hidden bg-brand-surface select-none",
          // Fallback if the app's JavaScript never runs: hide on its own rather than cover the page.
          "animate-splash-failsafe",
          "transition-opacity duration-500 ease-out",
          phase === "leaving" && "pointer-events-none opacity-0",
        )}
      >
        {/* Soft light behind the logo, and the auth panel's dot grid fading out toward the edges. */}
        <div className="absolute inset-0 bg-[radial-gradient(45%_38%_at_50%_50%,oklch(0.56_0.16_264.48/0.32)_0%,transparent_100%)]" />
        <div className="bg-grid-faint absolute inset-0 [mask-image:radial-gradient(60%_50%_at_50%_50%,black_0%,transparent_100%)]" />

        <div className="relative">
          <Logo
            inverse
            className="gap-4 motion-safe:animate-splash-in sm:gap-5 lg:gap-6"
            markClassName="size-14 sm:size-16 lg:size-20"
            wordmarkClassName="text-3xl motion-safe:animate-splash-word sm:text-[2.125rem] lg:text-[2.625rem]"
          />

          {/* Appears only if loading runs past the minimum display time. */}
          <div className="absolute inset-x-0 top-full mt-12 flex animate-splash-late justify-center gap-1.5">
            {[0, 160, 320].map((delay) => (
              <span
                key={delay}
                className="size-1.5 rounded-full bg-white/80 motion-safe:animate-splash-dot"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
      <noscript>
        <style>{"[data-splash]{display:none}"}</style>
      </noscript>
    </>
  );
}
