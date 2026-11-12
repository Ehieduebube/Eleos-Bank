import { getPaymentsMode } from "../config";
import { Errors } from "../errors";
import { createDemoRegistry } from "./demo";
import type { ProviderRegistry } from "./types";

/**
 * Live mode is deliberately not wired to any provider. Setting PAYMENTS_MODE=live
 * without implementing and verifying an adapter makes every payment fail loudly
 * rather than silently falling back to the simulator.
 *
 * To go live for a service: implement the matching interface in ./types.ts
 * (e.g. a PaystackTransferProvider using sandbox keys first), validate webhooks,
 * add reconciliation, and return it from `createLiveRegistry` below.
 */
function notImplemented(service: string): never {
  throw Errors.notConfigured(
    `PAYMENTS_MODE=live is set, but no live ${service} adapter has been implemented and verified. ` +
      "No money was moved. Unset PAYMENTS_MODE to use demo mode, or add a live adapter (see README → Live integrations).",
  );
}

function createLiveRegistry(): ProviderRegistry {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === "name") return "live-unconfigured";
      if (prop === "then" || typeof prop === "symbol") return undefined;
      return () => notImplemented(String(prop));
    },
  };
  const stub = new Proxy({}, handler) as never;
  return { mode: "live", verification: stub, transfers: stub, telco: stub, bills: stub, betting: stub };
}

type GlobalWithRegistry = typeof globalThis & { __eleosProviders?: ProviderRegistry };

export function getProviderRegistry(): ProviderRegistry {
  const g = globalThis as GlobalWithRegistry;
  if (!g.__eleosProviders) {
    g.__eleosProviders = getPaymentsMode() === "live" ? createLiveRegistry() : createDemoRegistry({ latencyMs: 450 });
  }
  return g.__eleosProviders;
}
