import { LedgerEntryType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function addDebtEntry(input: {
  resellerId: string;
  amountCents: number;
  type: LedgerEntryType;
  reason: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<void> {
  await prisma.debtLedgerEntry.create({
    data: {
      resellerId: input.resellerId,
      amountCents: input.amountCents,
      entryType: input.type,
      reason: input.reason,
      referenceType: input.referenceType,
      referenceId: input.referenceId
    }
  });
}

export async function getDebtBalanceCents(resellerId: string): Promise<number> {
  const rows = await prisma.debtLedgerEntry.findMany({
    where: { resellerId },
    select: { amountCents: true, entryType: true }
  });

  return rows.reduce((sum, row) => {
    if (row.entryType === LedgerEntryType.debit) return sum + row.amountCents;
    return sum - row.amountCents;
  }, 0);
}
