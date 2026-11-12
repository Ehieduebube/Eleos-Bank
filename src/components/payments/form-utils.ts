import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/** Copy server-side field errors onto a react-hook-form instance. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, errors: Record<string, string> | null): boolean {
  if (!errors) return false;
  let applied = false;
  for (const [field, message] of Object.entries(errors)) {
    if (field in form.getValues()) {
      form.setError(field as Path<T>, { type: "server", message }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied;
}
