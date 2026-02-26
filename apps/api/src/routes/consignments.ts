import { LedgerEntryType } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit.js";
import { addDebtEntry } from "../services/ledger.js";
import { createSystemMessageForReseller } from "../services/chat.js";
import { parsePagination } from "../lib/pagination.js";

export const consignmentsRouter = Router();
consignmentsRouter.use(requireAuth);

consignmentsRouter.get("/", async (_req, res) => {
  const { skip, take, page, pageSize } = parsePagination(_req.query as Record<string, string | string[]>);
  const [consignments, total] = await Promise.all([
    prisma.consignment.findMany({
      include: {
        device: true,
        reseller: { include: { user: true } },
        movements: true
      },
      orderBy: { assignedAt: "desc" },
      skip,
      take
    }),
    prisma.consignment.count()
  ]);
  res.json({ consignments, meta: { page, pageSize, total } });
});

const PAYMENT_METHODS = ["consignacion", "usdt", "transferencia", "dolar_billete"] as const;

consignmentsRouter.post("/", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const input = req.body as {
    deviceId: string;
    resellerId: string;
    note?: string;
    paymentMethod?: string;
    salePriceCents?: number;
    amountPaidCents?: number;
  };
  const device = await prisma.device.findUnique({
    where: { id: input.deviceId },
    select: { id: true, state: true, costCents: true, model: true }
  });
  if (!device) {
    res.status(404).json({ error: "Equipo no encontrado" });
    return;
  }
  if (device.state !== "available") {
    res.status(400).json({ error: "El equipo no está disponible para consignación" });
    return;
  }
  const activeConsignment = await prisma.consignment.findFirst({
    where: { deviceId: input.deviceId, status: "active" }
  });
  if (activeConsignment) {
    res.status(400).json({ error: "El equipo ya tiene una consignación activa" });
    return;
  }
  const paymentMethod = input.paymentMethod && PAYMENT_METHODS.includes(input.paymentMethod as typeof PAYMENT_METHODS[number])
    ? input.paymentMethod
    : "consignacion";
  const amountPaidCents = Math.max(0, Math.round(Number(input.amountPaidCents) || 0));
  const salePriceCents = Math.max(0, Math.round(Number(input.salePriceCents) || 0)) || null;

  const consignment = await prisma.consignment.create({
    data: {
      deviceId: input.deviceId,
      resellerId: input.resellerId,
      assignedById: actorId,
      salePriceCents: salePriceCents || undefined,
      movements: {
        create: {
          movementType: "assigned",
          note: [input.note, paymentMethod !== "consignacion" ? `Pago: ${paymentMethod}, ${(amountPaidCents / 100).toFixed(2)} USD` : null]
            .filter(Boolean)
            .join(" · ") || input.note,
          createdById: actorId
        }
      }
    },
    include: { reseller: true, device: true }
  });

  await prisma.device.update({
    where: { id: input.deviceId },
    data: { state: "consigned", resellerId: input.resellerId }
  });

  // Deuda = precio de venta (o costo si no se indicó venta) − lo que paga ahora
  const priceCents = salePriceCents ?? device.costCents ?? 0;
  const debtCents = priceCents - amountPaidCents;
  if (debtCents > 0) {
    const methodLabel = { consignacion: "consignación", usdt: "USDT", transferencia: "transferencia", dolar_billete: "dólar billete" }[paymentMethod] ?? paymentMethod;
    await addDebtEntry({
      resellerId: input.resellerId,
      amountCents: debtCents,
      type: LedgerEntryType.debit,
      reason: `Pedido/consignación: ${device.model}${amountPaidCents > 0 ? ` — pagó ${(amountPaidCents / 100).toFixed(2)} USD (${methodLabel}), saldo pendiente` : ""}`,
      referenceType: "consignment",
      referenceId: consignment.id
    });
  }

  await writeAuditLog({
    actorId,
    action: "consignment.assigned",
    entityType: "consignment",
    entityId: consignment.id,
    meta: { deviceId: input.deviceId, resellerId: input.resellerId, paymentMethod, salePriceCents, amountPaidCents }
  });

  await createSystemMessageForReseller({
    resellerId: input.resellerId,
    body: amountPaidCents > 0
      ? `Se asignó equipo ${consignment.device.model}. Valor venta ${(priceCents / 100).toFixed(2)} USD. Pagó ${(amountPaidCents / 100).toFixed(2)} USD; saldo a debitar: ${(debtCents / 100).toFixed(2)} USD.`
      : salePriceCents
        ? `Se asignó equipo ${consignment.device.model} en consignación. Valor de venta: ${(salePriceCents / 100).toFixed(2)} USD.`
        : `Se asignó equipo ${consignment.device.model} en consignación.`
  });

  res.status(201).json({ consignment });
});

consignmentsRouter.post("/:id/sold", requireRole("reseller", "admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const input = req.body as { saleAmountCents: number; note?: string };
  const consignmentId = String(req.params.id);
  const consignment = await prisma.consignment.findUnique({
    where: { id: consignmentId },
    include: { reseller: { include: { user: true } }, device: true }
  });

  if (!consignment) {
    res.status(404).json({ error: "Consignación no encontrada" });
    return;
  }

  if (req.user!.role === "reseller" && consignment.reseller.userId !== actorId) {
    res.status(403).json({ error: "No autorizado para esta consignación" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.consignment.update({
      where: { id: consignment.id },
      data: {
        status: "sold",
        movements: {
          create: {
            movementType: "sold",
            note: input.note,
            createdById: actorId
          }
        }
      }
    });

    await tx.device.update({
      where: { id: consignment.deviceId },
      data: { state: "sold" }
    });
  });

  await addDebtEntry({
    resellerId: consignment.resellerId,
    amountCents: input.saleAmountCents,
    type: LedgerEntryType.debit,
    reason: "Venta de equipo en consignación",
    referenceType: "consignment",
    referenceId: consignment.id
  });

  await createSystemMessageForReseller({
    resellerId: consignment.resellerId,
    body: `Venta registrada: ${consignment.device.model}. Deuda incrementada en ${(input.saleAmountCents / 100).toFixed(2)} USD.`
  });

  res.json({ ok: true });
});
