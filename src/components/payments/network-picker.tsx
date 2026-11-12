"use client";

import { NETWORKS, type NetworkId } from "@/lib/catalog/networks";
import { cn } from "@/lib/utils";
import { TILE_TRANSITION, tileClass } from "@/components/shared/tile-classes";

export function NetworkPicker({ value, onChange, invalid, id }: { value: string; onChange: (id: NetworkId) => void; invalid?: boolean; id?: string }) {
  return (
    <div id={id} role="radiogroup" aria-label="Network" aria-invalid={invalid || undefined} className="grid grid-cols-4 gap-2">
      {NETWORKS.map((network) => {
        const selected = value === network.id;
        return (
          <button
            key={network.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(network.id)}
            className={cn(
              `flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium ${TILE_TRANSITION} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`,
              tileClass(selected),
              invalid && !value && "border-destructive/60",
            )}
          >
            <span
              className="flex size-9 items-center justify-center rounded-full text-[0.65rem] font-bold"
              style={{ background: network.color, color: network.textColor }}
              aria-hidden="true"
            >
              {network.name.slice(0, network.id === "9mobile" ? 2 : 1).toUpperCase()}
            </span>
            {network.name}
          </button>
        );
      })}
    </div>
  );
}
