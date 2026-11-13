"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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

type Phase = "shown" | "leaving" | "gone";

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Resolves once the whole streamed document, and everything it loads, has arrived. */
function documentLoaded() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

/** Whether the inline launch script chose to show the splash on this load (see splash-launch.ts). */
function isLaunch() {
  return window.__eleosSplash === "launch" || window.__eleosSplash === "running";
}

/**
 * Full-screen brand splash, shown when Eleos is launched (the first load in a browser tab).
 *
 * It is server-rendered on every full load but hidden by CSS unless the inline launch script
 * set <html data-splash>, so a refresh never flashes it. It lives in the root layout, which
 * persists across client-side navigation, so it never replays when moving between pages,
 * signing in or signing out.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("shown");

  // Keep <html data-splash> in step with the phase: it is what shows the splash and hides the
  // page beneath it (globals.css). The launch script sets it first; setting it here as well
  // restores it after React's dev-only Strict Mode remount, which clears <html> attributes
  // React doesn't manage.
  useLayoutEffect(() => {
    if (!isLaunch()) return;
    const root = document.documentElement;
    if (phase === "gone") {
      window.__eleosSplash = "done";
      root.removeAttribute("data-splash");
    } else {
      window.__eleosSplash = "running";
      root.setAttribute("data-splash", phase === "shown" ? "show" : "leaving");
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "leaving") {
      const timer = window.setTimeout(() => setPhase("gone"), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "shown") return;

    if (!isLaunch()) {
      // Not a launch (a refresh, back/forward or a later load in this tab): the splash never
      // showed, so just drop its hidden markup.
      const frame = window.requestAnimationFrame(() => setPhase("gone"));
      return () => window.cancelAnimationFrame(frame);
    }

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
    <div
      data-splash-screen=""
      className={cn(
        // Displayed (as flex) only while <html data-splash> is set: see globals.css.
        "fixed inset-0 z-[100] touch-none items-center justify-center overflow-hidden bg-brand-surface select-none",
        "transition-opacity duration-500 ease-out",
        phase === "leaving" && "pointer-events-none opacity-0",
      )}
    >
      {/* Soft light behind the logo, and the auth panel's dot grid fading out toward the edges. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(45%_38%_at_50%_50%,oklch(0.56_0.16_264.48/0.32)_0%,transparent_100%)]" />
      <div aria-hidden="true" className="bg-grid-faint absolute inset-0 [mask-image:radial-gradient(60%_50%_at_50%_50%,black_0%,transparent_100%)]" />

      {/* The logo and name sit at the exact centre; the tagline and loading dots hang below them. */}
      <div className="relative">
        <Logo
          inverse
          className="gap-4 motion-safe:animate-splash-in sm:gap-5 lg:gap-6"
          markClassName="size-14 sm:size-16 lg:size-20"
          wordmarkClassName="text-3xl motion-safe:animate-splash-word sm:text-[2.125rem] lg:text-[2.625rem]"
        />

        <div className="absolute inset-x-0 top-full mt-5 flex flex-col items-center gap-10 sm:mt-6 lg:mt-7">
          <p className="text-[0.9375rem] font-normal tracking-[0.015em] whitespace-nowrap text-brand-200/80 motion-safe:animate-splash-tagline sm:text-base lg:text-lg">
            A smarter way to bank.
          </p>

          {/* Appears only if loading runs past the minimum display time. */}
          <div aria-hidden="true" className="flex animate-splash-late gap-1.5">
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
    </div>
  );
}
