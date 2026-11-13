"use client";

import { useSyncExternalStore } from "react";
import { scrollRestoreScript } from "./scroll-restore";

const subscribe = () => () => undefined;

/**
 * The scroll-restore script, in the server-rendered HTML only: that is where it has to run.
 * An inline script that React creates in the browser never runs (and React flags it in
 * development), so once hydrated, or when the app layout first renders through an in-app
 * navigation such as signing in, this renders nothing.
 */
export function ScrollRestoreScript() {
  const inServerHtml = useSyncExternalStore(subscribe, () => false, () => true);
  return inServerHtml ? <script dangerouslySetInnerHTML={{ __html: scrollRestoreScript }} /> : null;
}
