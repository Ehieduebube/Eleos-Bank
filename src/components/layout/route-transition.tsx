"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { RouteSkeleton, hasRouteSkeleton } from "@/components/skeletons/route-skeleton";

/** An in-app navigation that has started, from one page to another, and not yet landed. */
interface PendingNavigation {
  from: string;
  to: string;
}

interface RouteTransition {
  /** The page being navigated to, while its skeleton is showing. */
  target: string | null;
  /** Show the target page's skeleton for a navigation started in code (router.push). */
  start: (href: string) => void;
}

const RouteTransitionContext = createContext<RouteTransition>({ target: null, start: () => undefined });

/** If a navigation never lands (it should land or fail long before this), stop covering the page. */
const FAILSAFE_MS = 15000;

/**
 * Loading skeletons for in-app navigation, and only for in-app navigation.
 *
 * Pages are dynamic, so moving between them waits on the server. While it does, the page being
 * left is hidden and the destination's skeleton shows in its place, and the nav highlights the
 * destination straight away. A full load (refresh, new tab) never involves this: the server
 * sends the finished page, so the browser keeps showing the current page until the new one
 * paints, and restores the scroll position against the real content.
 */
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [landedOn, setLandedOn] = useState(pathname);
  // A new URL means the navigation landed (or another one replaced it): drop the pending state.
  if (landedOn !== pathname) {
    setLandedOn(pathname);
    setPending(null);
  }
  const target = pending && pending.from === pathname ? pending.to : null;

  const start = useCallback((href: string) => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
    if (!hasRouteSkeleton(url.pathname)) return;
    setPending({ from: window.location.pathname, to: url.pathname });
  }, []);

  useEffect(() => {
    // Next's <Link> handles a plain click on an in-app link itself and cancels the browser's
    // own navigation, so a click that reaches the window already default-prevented is a
    // client-side navigation under way. Modified clicks (new tab, new window) are left alone.
    const onClick = (event: MouseEvent) => {
      if (!event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      start(link.href);
    };
    // Back/forward replaces whatever navigation was in flight.
    const onPopState = () => setPending(null);
    window.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  useEffect(() => {
    if (!target) return;
    const timer = window.setTimeout(() => setPending(null), FAILSAFE_MS);
    return () => window.clearTimeout(timer);
  }, [target]);

  return <RouteTransitionContext value={{ target, start }}>{children}</RouteTransitionContext>;
}

/** The page content, or the destination's skeleton while a navigation to it is in flight. */
export function RouteContent({ children }: { children: ReactNode }) {
  const { target } = useContext(RouteTransitionContext);
  return (
    <>
      {/* The page being left stays exactly as it is, only invisible, until the next one replaces it.
          Its height and scroll position are untouched, so when the URL changes the browser records
          where you were on it (Back returns there); and with display: none its charts would
          measure themselves at 0×0. */}
      <div className={target ? "invisible" : undefined}>{children}</div>
      {target && (
        // The destination's skeleton, over the content area of the screen (below the header, beside
        // the sidebar; padding as on <main>) at whatever point the page being left is scrolled to.
        // Next.js scrolls to the top when the new page arrives.
        <div className="fixed inset-x-0 top-16 bottom-0 z-10 overflow-hidden lg:left-64">
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <RouteSkeleton pathname={target} />
          </div>
        </div>
      )}
    </>
  );
}

/** The current page for navigation highlights: the destination as soon as a navigation starts. */
export function useNavPathname() {
  const pathname = usePathname();
  return useContext(RouteTransitionContext).target ?? pathname;
}

export function useStartNavigation() {
  return useContext(RouteTransitionContext).start;
}
