/**
 * Keeps a refreshed page where it was scrolled to, from its first frame.
 *
 * Browsers restore the scroll position of a reloaded page themselves, but only once enough of it
 * has loaded (Safari: at the `load` event). Until then they paint what has arrived so far,
 * scrolled to the top: refreshing the dashboard halfway down showed its greeting and balance
 * card before the page jumped back down to where you were.
 *
 * Two inline scripts make a refresh land in place:
 *  - In <head> (root layout): if this load is a refresh of a page that was scrolled down, mark
 *    <html data-restoring-scroll>, which keeps the page unpainted (globals.css). The browser
 *    keeps showing the page being refreshed meanwhile.
 *  - Straight after the app layout's markup (scroll-restore-script.tsx): scroll to the saved
 *    position, then let the page paint. It also saves the position when the page unloads.
 * The browser's own restore afterwards lands on the same spot. Positions are kept per tab
 * (sessionStorage), for the page that was open.
 */

const KEY = "eleos-scroll";
/** If the page's markup never arrives, stop holding back the paint after this long. */
const FAILSAFE_MS = 4000;
/** After `load`, hand scroll restoration (back/forward) back to the browser. */
const RESUME_BROWSER_RESTORE_MS = 1000;

export const scrollRestoreHeadScript = `(function () {
  try {
    var saved = JSON.parse(sessionStorage.getItem("${KEY}") || "null");
    sessionStorage.removeItem("${KEY}");
    var nav = performance.getEntriesByType("navigation")[0];
    if (!saved || saved.url !== location.pathname + location.search || !(saved.y > 0)) return;
    if (!nav || nav.type !== "reload" || location.hash) return;
    var root = document.documentElement;
    window.__eleosRestoreScroll = saved.y;
    root.setAttribute("data-restoring-scroll", "");
    setTimeout(function () { root.removeAttribute("data-restoring-scroll"); }, ${FAILSAFE_MS});
    // This load restores its own position. The browser's own restore, when loading finishes, could
    // move the page again (Safari can apply a stale position), so it sits this one out.
    history.scrollRestoration = "manual";
    addEventListener("load", function () {
      setTimeout(function () { history.scrollRestoration = "auto"; }, ${RESUME_BROWSER_RESTORE_MS});
    });
  } catch (e) {}
})();`;

export const scrollRestoreScript = `(function () {
  try {
    addEventListener("pagehide", function () {
      try { sessionStorage.setItem("${KEY}", JSON.stringify({ url: location.pathname + location.search, y: Math.round(scrollY) })); } catch (e) {}
    });
    if (window.__eleosRestoreScroll) scrollTo(0, window.__eleosRestoreScroll);
  } catch (e) {}
  document.documentElement.removeAttribute("data-restoring-scroll");
})();`;
