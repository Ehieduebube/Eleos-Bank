/**
 * Shared look for selectable tiles (networks, bundles, plans, providers, presets,
 * beneficiaries, theme choices). Selected tiles get the brand outline, a soft
 * brand fill and a gentle glow; idle tiles warm up to the brand tint on hover.
 */
export const TILE_TRANSITION = "transition-[color,background-color,border-color,box-shadow] duration-200";

export function tileClass(selected: boolean) {
  return selected
    ? "border-brand-glow bg-brand-soft shadow-glow-tile"
    : "border-border bg-card hover:border-brand-soft-border hover:bg-brand-soft/60";
}
