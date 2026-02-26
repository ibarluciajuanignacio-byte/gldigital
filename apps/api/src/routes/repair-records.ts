import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const repairRecordsRouter = Router();
repairRecordsRouter.use(requireAuth);
repairRecordsRouter.use(requireRole("admin"));

// Historial de reparaciones de un dispositivo (por deviceId)
repairRecordsRouter.get("/", async (req, res) => {
  const deviceId = req.query.deviceId as string | undefined;
  if (!deviceId) {
    res.status(400).json({ message: "Faltan deviceId en la consulta." });
    return;
  }
  const records = await prisma.repairRecord.findMany({
    where: { deviceId },
    orderBy: { sentAt: "desc" },
    include: { technician: { select: { id: true, name: true } } }
  });
  res.json({ repairRecords: records });
});

const createSchema = z.object({
  deviceId: z.string().uuid(),
  technicianId: z.string().uuid(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  priceCents: z.number().int().min(0).optional()
});

const updateSchema = z.object({
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  priceCents: z.number().int().min(0).optional().nullable()
});

// Crear registro de reparación (envío a técnico) y actualizar el dispositivo
repairRecordsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const { deviceId, technicianId, reason, notes, priceCents } = parsed.data;
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    res.status(404).json({ message: "Dispositivo no encontrado." });
    return;
  }
  const technician = await prisma.technician.findUnique({ where: { id: technicianId } });
  if (!technician) {
    res.status(404).json({ message: "Técnico no encontrado." });
    return;
  }
  const openRecord = await prisma.repairRecord.findFirst({
    where: { deviceId, returnedAt: null }
  });
  if (openRecord) {
    res.status(400).json({ message: "Este equipo ya tiene una reparación en curso. Cerrá esa reparación antes de enviarlo de nuevo." });
    return;
  }
  const [record] = await prisma.$transaction([
    prisma.repairRecord.create({
      data: { deviceId, technicianId, reason: reason || null, notes: notes || null, priceCents: priceCents ?? null }
    }),
    prisma.device.update({
      where: { id: deviceId },
      data: { condition: "technical_service", technicianId }
    })
  ]);
  const withRelations = await prisma.repairRecord.findUnique({
    where: { id: record.id },
    include: { device: { select: { imei: true, model: true } }, technician: { select: { id: true, name: true } } }
  });
  res.status(201).json({ repairRecord: withRelations });
});

// Actualizar motivo, anotaciones o precio de una reparación (mientras está en curso)
repairRecordsRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const record = await prisma.repairRecord.findUnique({ where: { id } });
  if (!record) {
    res.status(404).json({ message: "Registro de reparación no encontrado." });
    return;
  }
  const data: { reason?: string | null; notes?: string | null; priceCents?: number | null } = {};
  if (parsed.data.reason !== undefined) data.reason = parsed.data.reason || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
  if (parsed.data.priceCents !== undefined) data.priceCents = parsed.data.priceCents;
  const updated = await prisma.repairRecord.update({
    where: { id },
    data
  });
  res.json({ repairRecord: updated });
});

// Cerrar reparación (devolución del equipo) y quitar dispositivo del técnico
repairRecordsRouter.post("/:id/return", async (req, res) => {
  const id = req.params.id;
  const body = z.object({ priceCents: z.number().int().min(0).optional() }).safeParse(req.body);
  const record = await prisma.repairRecord.findUnique({ where: { id } });
  if (!record) {
    res.status(404).json({ message: "Registro de reparación no encontrado." });
    return;
  }
  if (record.returnedAt) {
    res.status(400).json({ message: "Esta reparación ya está cerrada." });
    return;
  }
  const priceCents = body.success && body.data.priceCents !== undefined ? body.data.priceCents : record.priceCents;
  await prisma.$transaction([
    prisma.repairRecord.update({
      where: { id },
      data: { returnedAt: new Date(), ...(priceCents !== undefined && { priceCents }) }
    }),
    prisma.device.update({
      where: { id: record.deviceId },
      data: { condition: "sealed", technicianId: null }
    })
  ]);
  const updated = await prisma.repairRecord.findUnique({
    where: { id },
    include: { device: true, technician: true }
  });
  res.json({ repairRecord: updated });
});
