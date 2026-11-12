"use client";

import { BANKS, POPULAR_BANK_CODES } from "@/lib/catalog/banks";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const popular = POPULAR_BANK_CODES.map((code) => BANKS.find((b) => b.code === code)!).filter(Boolean);

export function BankSelect({
  value,
  onValueChange,
  id,
  invalid,
  disabled,
}: {
  value: string;
  onValueChange: (code: string) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className="w-full">
        <SelectValue placeholder="Select destination bank" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectGroup>
          <SelectLabel>Popular</SelectLabel>
          {popular.map((bank) => (
            <SelectItem key={`p-${bank.code}`} value={bank.code}>
              <BankDot name={bank.shortName} />
              {bank.name}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>All banks</SelectLabel>
          {BANKS.filter((b) => !POPULAR_BANK_CODES.includes(b.code)).map((bank) => (
            <SelectItem key={bank.code} value={bank.code}>
              <BankDot name={bank.shortName} />
              {bank.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Neutral monogram (we deliberately do not reproduce bank logos). */
export function BankDot({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[0.6rem] font-semibold text-secondary-foreground">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
