import { LedgerEntryType, PaymentStatus } from "@prisma/client";
import { Router } from "express";
import { createPaymentSchema } from "@gldigital/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { addDebtEntry } from "../services/ledger.js";
import { writeAuditLog } from "../services/audit.js";
import { createSystemMessageForReseller } from "../services/chat.js";
import { getIo } from "../sockets/index.js";
import { parsePagination } from "../lib/pagination.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req.query as Record<string, string | string[]>);
  const where = req.user!.role === "reseller" ? { resellerId: req.user!.resellerId } : {};
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        reseller: { include: { user: true } },
        reportedBy: true,
        reviewedBy: true
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.payment.count({ where })
  ]);
  res.json({ payments, meta: { page, pageSize, total } });
});

paymentsRouter.post("/report", requireRole("reseller", "admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const input = createPaymentSchema.parse(req.body);

  if (req.user!.role === "reseller" && input.resellerId !== req.user!.resellerId) {
    res.status(403).json({ error: "No autorizado para reportar este pago" });
    return;
  }

  const payment = await prisma.payment.create({
    data: {
      resellerId: input.resellerId,
      amountCents: Math.round(input.amount * 100),
      currency: input.currency,
      note: input.note,
      receiptKey: input.receiptAttachmentKey,
      reportedById: actorId,
      ...(input.cashBoxId && { cashBoxId: input.cashBoxId })
    },
    include: { reseller: { include: { user: true } } }
  });

  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "payment_reported",
      title: "Pago reportado",
      body: `${payment.reseller.user.name} reportó un pago de ${(payment.amountCents / 100).toFixed(2)} ${payment.currency}`
    }))
  });

  getIo().to("user:*");
  admins.forEach((admin) => {
    getIo().to(`user:${admin.id}`).emit("notification:new", {
      type: "payment_reported",
      paymentId: payment.id
    });
  });

  await writeAuditLog({
    actorId,
    action: "payment.reported",
    entityType: "payment",
    entityId: payment.id
  });

  await createSystemMessageForReseller({
    resellerId: payment.resellerId,
    body: `Pago reportado por ${(payment.amountCents / 100).toFixed(2)} ${payment.currency}. Queda pendiente de confirmación.`
  });

  res.status(201).json({ payment });
});

paymentsRouter.post("/:id/confirm", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const paymentId = String(req.params.id);
  const bodyCashBoxId = (req.body as { cashBoxId?: string })?.cashBoxId;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });
  if (!payment) {
    res.status(404).json({ error: "Pago no encontrado" });
    return;
  }
  if (payment.status !== PaymentStatus.reported_pending) {
    res.status(400).json({ error: "El pago ya fue procesado" });
    return;
  }

  const cashBoxId = bodyCashBoxId ?? payment.cashBoxId;
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.confirmed,
      reviewedById: actorId,
      reviewedAt: new Date(),
      ...(cashBoxId && { cashBoxId })
    }
  });

  await addDebtEntry({
    resellerId: updatedPayment.resellerId,
    amountCents: updatedPayment.amountCents,
    type: LedgerEntryType.credit,
    reason: "Pago confirmado por administrador",
    referenceType: "payment",
    referenceId: updatedPayment.id
  });

  if (cashBoxId) {
    const box = await prisma.cashBox.findUnique({ where: { id: cashBoxId }, select: { id: true } });
    if (box) {
      await prisma.cashMovement.create({
        data: {
          cashBoxId,
          type: "credit",
          amountCents: updatedPayment.amountCents,
          currency: updatedPayment.currency,
          description: `Pago revendedor confirmado`,
          referenceType: "payment",
          referenceId: updatedPayment.id
        }
      });
    }
  }

  await writeAuditLog({
    actorId,
    action: "payment.confirmed",
    entityType: "payment",
    entityId: updatedPayment.id
  });

  await createSystemMessageForReseller({
    resellerId: updatedPayment.resellerId,
    body: `Pago confirmado por ${(updatedPayment.amountCents / 100).toFixed(2)} ${updatedPayment.currency}. La deuda fue actualizada.`
  });

  res.json({ payment: updatedPayment });
});

paymentsRouter.post("/:id/reject", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const paymentId = String(req.params.id);
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });
  if (!payment) {
    res.status(404).json({ error: "Pago no encontrado" });
    return;
  }
  if (payment.status !== PaymentStatus.reported_pending) {
    res.status(400).json({ error: "El pago ya fue procesado" });
    return;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.rejected,
      reviewedById: actorId,
      reviewedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId,
    action: "payment.rejected",
    entityType: "payment",
    entityId: updatedPayment.id
  });

  await createSystemMessageForReseller({
    resellerId: updatedPayment.resellerId,
    body: `Pago rechazado por administrador. La deuda no se modificó.`
  });

  res.json({ payment: updatedPayment });
});
