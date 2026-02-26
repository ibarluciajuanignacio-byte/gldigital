import { Router } from "express";
import { LedgerEntryType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { addDebtEntry, getDebtBalanceCents } from "../services/ledger.js";
import { writeAuditLog } from "../services/audit.js";
import { createSystemMessageForReseller } from "../services/chat.js";

export const debtsRouter = Router();
debtsRouter.use(requireAuth);

debtsRouter.get("/summary", async (req, res) => {
  if (req.user!.role === "reseller" && !req.user!.resellerId) {
    res.status(400).json({ error: "Reseller profile not found" });
    return;
  }

  if (req.user!.role === "reseller") {
    const balanceCents = await getDebtBalanceCents(req.user!.resellerId!);
    const entries = await prisma.debtLedgerEntry.findMany({
      where: { resellerId: req.user!.resellerId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json({ balanceCents, entries });
    return;
  }

  const resellers = await prisma.reseller.findMany({
    include: { user: true }
  });

  const data = await Promise.all(
    resellers.map(async (reseller) => ({
      resellerId: reseller.id,
      resellerName: reseller.user.name,
      balanceCents: await getDebtBalanceCents(reseller.id)
    }))
  );

  res.json({ items: data });
});

debtsRouter.post("/entries", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const input = req.body as {
    resellerId?: string;
    entryType?: LedgerEntryType;
    amount?: number;
    reason?: string;
  };

  if (!input.resellerId || !input.entryType || typeof input.amount !== "number" || !input.reason?.trim()) {
    res.status(400).json({ error: "Datos invalidos para registrar deuda" });
    return;
  }
  if (input.amount <= 0) {
    res.status(400).json({ error: "El monto debe ser mayor a 0" });
    return;
  }
  if (input.entryType !== LedgerEntryType.debit && input.entryType !== LedgerEntryType.credit) {
    res.status(400).json({ error: "entryType invalido" });
    return;
  }

  const reseller = await prisma.reseller.findUnique({
    where: { id: input.resellerId },
    include: { user: true }
  });
  if (!reseller) {
    res.status(404).json({ error: "Revendedor no encontrado" });
    return;
  }

  const amountCents = Math.round(input.amount * 100);
  await addDebtEntry({
    resellerId: input.resellerId,
    amountCents,
    type: input.entryType,
    reason: input.reason.trim(),
    referenceType: "manual_admin_adjustment"
  });

  const lastEntry = await prisma.debtLedgerEntry.findFirst({
    where: {
      resellerId: input.resellerId,
      amountCents,
      entryType: input.entryType,
      reason: input.reason.trim()
    },
    orderBy: { createdAt: "desc" }
  });

  await writeAuditLog({
    actorId,
    action: "debt.entry.created",
    entityType: "debt_ledger_entry",
    entityId: lastEntry?.id ?? input.resellerId,
    meta: {
      resellerId: input.resellerId,
      entryType: input.entryType,
      amountCents
    }
  });

  await createSystemMessageForReseller({
    resellerId: input.resellerId,
    body:
      input.entryType === LedgerEntryType.debit
        ? `Se registro un ajuste de deuda por ${(amountCents / 100).toFixed(2)} USD.`
        : `Se registro un ajuste a favor por ${(amountCents / 100).toFixed(2)} USD.`
  });

  res.status(201).json({ ok: true, entryId: lastEntry?.id ?? null });
});
