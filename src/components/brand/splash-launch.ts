/**
 * The splash screen plays when Eleos is launched, not on every page load: only on the first
 * load in a browser tab. Refreshes, back/forward and later full loads in the same tab go
 * straight to the page and its loading skeletons.
 *
 * That has to be decided before the first paint (a refresh must not flash the splash), so it
 * runs as an inline script in <head> (app/layout.tsx). When it is a launch, the script sets
 * <html data-splash="show">, which shows the splash and hides the page beneath it
 * (globals.css), and hands over to <SplashScreen> through `window.__eleosSplash`.
 */

declare global {
  interface Window {
    /** "launch": the script chose to show the splash; "running": SplashScreen has taken over; "done". */
    __eleosSplash?: "launch" | "running" | "done";
  }
}

const SEEN_KEY = "eleos-splash-seen";
/** If the app never starts, stop covering the page after this long. */
const FAILSAFE_MS = 15000;

export const splashLaunchScript = `(function () {
  try {
    if (location.pathname.indexOf("/receipt/") === 0) return; // printable receipt, opened in its own tab
    var nav = performance.getEntriesByType("navigation")[0];
    if (nav && nav.type !== "navigate") return; // a refresh or back/forward
    if (sessionStorage.getItem("${SEEN_KEY}")) return; // already launched in this tab
    sessionStorage.setItem("${SEEN_KEY}", "1");
    window.__eleosSplash = "launch";
    document.documentElement.setAttribute("data-splash", "show");
    setTimeout(function () {
      if (window.__eleosSplash !== "launch") return;
      window.__eleosSplash = "done";
      document.documentElement.removeAttribute("data-splash");
    }, ${FAILSAFE_MS});
  } catch (e) {}
})();`;
