"use server";

import { z } from "zod";
import { getBank } from "@/lib/catalog/banks";
import type { ActionResult, Beneficiary } from "@/lib/types";
import { beneficiarySchema, type BeneficiaryInput } from "@/lib/validation";
import { parseOrThrow, requireActionUser, revalidateApp, runAction } from "@/server/action-utils";
import { getEngineDeps } from "@/server/context";
import { AppError } from "@/server/errors";

/** Resolve the account holder name on the server; the client-displayed name is never trusted. */
async function resolveBeneficiary(values: BeneficiaryInput) {
  const input = parseOrThrow(beneficiarySchema, values);
  const deps = await getEngineDeps();
  const lookup = await deps.providers.verification.resolveAccount({ bankCode: input.bankCode, accountNumber: input.accountNumber });
  if (!lookup.ok) throw new AppError("VERIFICATION_FAILED", lookup.reason, { accountNumber: lookup.reason });
  return {
    deps,
    data: {
      bankCode: input.bankCode,
      bankName: getBank(input.bankCode)!.name,
      accountNumber: input.accountNumber,
      accountName: lookup.accountName,
      nickname: input.nickname || null,
    },
  };
}

export async function createBeneficiaryAction(values: BeneficiaryInput): Promise<ActionResult<Beneficiary>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const { deps, data } = await resolveBeneficiary(values);
    return deps.repo.createBeneficiary(user.id, data);
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function updateBeneficiaryAction(id: string, values: BeneficiaryInput): Promise<ActionResult<Beneficiary>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const beneficiaryId = parseOrThrow(z.uuid(), id);
    const { deps, data } = await resolveBeneficiary(values);
    return deps.repo.updateBeneficiary(user.id, beneficiaryId, data);
  });
  if (result.ok) revalidateApp();
  return result;
}

export async function deleteBeneficiaryAction(id: string): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const beneficiaryId = parseOrThrow(z.uuid(), id);
    const deps = await getEngineDeps();
    await deps.repo.deleteBeneficiary(user.id, beneficiaryId);
    return null;
  });
  if (result.ok) revalidateApp();
  return result;
}
