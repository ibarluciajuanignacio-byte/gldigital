import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isValidModelMemoryColor } from "../data/phoneCatalog.js";
import { writeAuditLog } from "../services/audit.js";
export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.get("/", async (req, res) => {
  const query = req.query as Record<string, string | string[]>;
  const page = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1);
  const pageSize = Math.min(2000, Math.max(1, Number(Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  let baseWhere: Prisma.DeviceWhereInput = {};
  const locationParam = Array.isArray(query.location) ? query.location[0] : query.location;
  if (locationParam && typeof locationParam === "string") {
    const loc = locationParam.trim();
    if (loc === "__none__" || loc.toLowerCase() === "sin asignar") {
      baseWhere = { ...baseWhere, OR: [{ location: null }, { location: "" }] };
    } else if (loc) {
      baseWhere = { ...baseWhere, location: loc };
    }
  }
  if (req.user?.role === "reseller") {
    const visibleStates = await prisma.deviceStatus.findMany({
      where: { isActive: true, isVisibleForReseller: true },
      select: { key: true }
    });
    baseWhere = { state: { in: visibleStates.map((s) => s.key) } };
  }
  const [devices, total] = await Promise.all([
    prisma.device.findMany({
      where: baseWhere,
      orderBy: [{ model: "asc" }, { createdAt: "desc" }],
      include: {
        reseller: { include: { user: true } },
        technician: { select: { id: true, name: true } },
        purchaseOrderItem: {
          select: { displayModel: true, purchaseOrder: { select: { id: true, orderNumber: true } } }
        },
        repairRecords: {
          where: { returnedAt: null },
          take: 1,
          orderBy: { sentAt: "desc" },
          select: { id: true, reason: true, notes: true, priceCents: true, sentAt: true }
        }
      },
      skip,
      take
    }),
    prisma.device.count({ where: baseWhere })
  ]);
  const statuses = await prisma.deviceStatus.findMany({ where: { isActive: true } });
  const map = Object.fromEntries(statuses.map((s) => [s.key, s]));
  const withStatus = devices.map((d) => ({ ...d, status: map[d.state] ?? null }));
  res.json({ devices: withStatus, meta: { page, pageSize, total } });
});

const MANUAL_ACCESSORY_PREFIX = "MANUAL-";

devicesRouter.post("/", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const createDeviceSchema = z.object({
    serialNumber: z.string().trim().optional(),
    imei: z.string().trim().optional(),
    model: z.string().trim().min(2, "El modelo/descripción es obligatorio."),
    color: z.string().trim().min(1).optional(),
    memory: z.string().trim().min(1).optional(),
    warrantyStatus: z.string().trim().min(1).optional(),
    batteryCycles: z.number().int().min(0).max(5000).optional(),
    batteryHealth: z.number().int().min(0).max(100).optional(),
    batteryStatus: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).default("available"),
    condition: z.enum(["sealed", "used", "technical_service"]).default("sealed"),
    technicianId: z.string().uuid().optional().nullable(),
    location: z.string().trim().min(1).optional(),
    sourceType: z.enum(["trade_in", "manual"]).optional(),
    productType: z.enum(["phone", "airpods", "cargador", "cable", "ipad"]).optional(),
    quantity: z.number().int().min(1).max(1000).optional().default(1)
  });
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Datos inválidos para crear equipo."
    });
    return;
  }

  const input = parsed.data;
  // Solo accesorios sin IMEI: AirPods, Cargador, Cable. iPad y equipos llevan IMEI.
  const isAccessory = input.sourceType === "manual" && input.productType && ["airpods", "cargador", "cable"].includes(input.productType);
  const quantity = isAccessory ? Math.min(1000, Math.max(1, input.quantity ?? 1)) : 1;

  function getAccessoryImei(index: number): string {
    const raw = (input.imei ?? "").trim();
    const base = input.productType!.toUpperCase();
    if (raw && quantity === 1) {
      if (raw.length > 50) return "";
      return raw.startsWith(MANUAL_ACCESSORY_PREFIX) ? raw : `${MANUAL_ACCESSORY_PREFIX}${base}-${raw}`;
    }
    return `${MANUAL_ACCESSORY_PREFIX}${base}-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  }

  let imeiToUse: string;
  if (isAccessory) {
    imeiToUse = getAccessoryImei(0);
    if (quantity === 1 && (input.imei ?? "").trim().length > 50) {
      res.status(400).json({ message: "El código/referencia no puede superar 50 caracteres." });
      return;
    }
  } else {
    if (!input.imei || !/^\d{10,20}$/.test(input.imei.replace(/\s/g, ""))) {
      res.status(400).json({ message: "El IMEI debe contener solo dígitos (10 a 20)." });
      return;
    }
    imeiToUse = input.imei.replace(/\s/g, "");
  }

  if (input.sourceType === "trade_in") {
    if (!input.memory?.trim() || !input.color?.trim()) {
      res.status(400).json({ message: "Para trade-in son obligatorios modelo, memoria y color del catálogo." });
      return;
    }
    if (!isValidModelMemoryColor(input.model, input.memory, input.color)) {
      res.status(400).json({ message: "Combinación modelo / memoria / color no válida según el catálogo." });
      return;
    }
  } else if (!isAccessory && input.model && input.memory && input.color && !isValidModelMemoryColor(input.model, input.memory, input.color)) {
    res.status(400).json({ message: "Combinación modelo / memoria / color no válida según el catálogo." });
    return;
  }
  if (!input.sourceType && !isAccessory && (!input.serialNumber || input.serialNumber.length < 2)) {
    res.status(400).json({ message: "N° de serie obligatorio para ingreso manual. Para equipos de compra usá Compras → Recepción por IMEI." });
    return;
  }
  const stateExists = await prisma.deviceStatus.findFirst({
    where: { key: input.state, isActive: true },
    select: { id: true }
  });
  if (!stateExists) {
    res.status(400).json({ message: "Estado inválido o inactivo para crear equipo." });
    return;
  }

  try {
    const isSealed = input.condition === "sealed";
    if (input.condition === "technical_service" && input.technicianId) {
      const tech = await prisma.technician.findUnique({ where: { id: input.technicianId }, select: { id: true } });
      if (!tech) {
        res.status(400).json({ message: "Técnico no encontrado." });
        return;
      }
    }
    const createOne = (imei: string) =>
      prisma.device.create({
        data: {
          imei,
          serialNumber: input.serialNumber && input.serialNumber.length >= 2 ? input.serialNumber : null,
          model: input.model,
          color: input.color ?? null,
          memory: input.memory ?? null,
          warrantyStatus: input.warrantyStatus ?? (isSealed ? "1 año" : null),
          batteryCycles: input.batteryCycles ?? (isSealed ? 0 : null),
          batteryHealth: input.batteryHealth ?? (isSealed ? 100 : null),
          batteryStatus: input.batteryStatus ?? null,
          state: input.state,
          condition: input.condition,
          technicianId: input.technicianId ?? null,
          location: input.location ?? null,
          sourceType: input.sourceType ?? "manual"
        }
      });

    let device;
    if (isAccessory && quantity > 1) {
      const created: Array<{ id: string; imei: string }> = [];
      for (let i = 0; i < quantity; i++) {
        const imei = getAccessoryImei(i);
        device = await createOne(imei);
        created.push({ id: device.id, imei: device.imei });
        await writeAuditLog({
          actorId,
          action: "device.created",
          entityType: "device",
          entityId: device.id,
          meta: { imei: device.imei, quantity: `${i + 1}/${quantity}` }
        });
      }
      res.status(201).json({ device, created: quantity });
    } else {
      device = await createOne(imeiToUse);
      await writeAuditLog({
        actorId,
        action: "device.created",
        entityType: "device",
        entityId: device.id,
        meta: { imei: device.imei }
      });
      res.status(201).json({ device });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({ message: "Ya existe un equipo con ese IMEI." });
      return;
    }
    throw error;
  }
});

devicesRouter.patch("/:id/state", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const payload = z.object({ state: z.string().trim().min(1) }).safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ message: "Estado inválido." });
    return;
  }
  const state = payload.data.state;
  const stateExists = await prisma.deviceStatus.findFirst({
    where: { key: state, isActive: true },
    select: { id: true }
  });
  if (!stateExists) {
    res.status(400).json({ message: "Estado inválido o inactivo." });
    return;
  }
  const deviceId = String(req.params.id);
  const device = await prisma.device.update({
    where: { id: deviceId },
    data: { state }
  });

  await writeAuditLog({
    actorId,
    action: "device.state.updated",
    entityType: "device",
    entityId: device.id,
    meta: { state }
  });

  res.json({ device });
});

// Actualizar condición y/o técnico del equipo (enviar a técnico, quitar de técnico)
devicesRouter.patch("/:id", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const deviceId = String(req.params.id);
  const payload = z
    .object({
      condition: z.enum(["sealed", "used", "technical_service"]).optional(),
      technicianId: z.string().uuid().nullable().optional()
    })
    .safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ message: "Datos inválidos." });
    return;
  }
  const data: { condition?: string; technicianId?: string | null } = {};
  if (payload.data.condition !== undefined) data.condition = payload.data.condition;
  if (payload.data.technicianId !== undefined) data.technicianId = payload.data.technicianId;
  if (Object.keys(data).length === 0) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ message: "Equipo no encontrado." });
      return;
    }
    return res.json({ device });
  }
  if (data.technicianId) {
    const tech = await prisma.technician.findUnique({ where: { id: data.technicianId }, select: { id: true } });
    if (!tech) {
      res.status(400).json({ message: "Técnico no encontrado." });
      return;
    }
  }
  const device = await prisma.device.update({
    where: { id: deviceId },
    data
  });
  await writeAuditLog({
    actorId,
    action: "device.updated",
    entityType: "device",
    entityId: device.id,
    meta: data
  });
  res.json({ device });
});

// Eliminar equipo de stock (solo si no está consignado ni asignado a revendedor)
devicesRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const actorId = String(req.user!.id);
  const deviceId = String(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: {
      consignments: { take: 1 },
      repairRecords: { where: { returnedAt: null }, take: 1 }
    }
  });
  if (!device) {
    res.status(404).json({ message: "Equipo no encontrado." });
    return;
  }
  if (device.resellerId != null) {
    res.status(400).json({ message: "No se puede eliminar: el equipo está asignado a un revendedor. Quitá la consignación primero." });
    return;
  }
  if (device.consignments.length > 0) {
    res.status(400).json({ message: "No se puede eliminar: el equipo tiene consignaciones. Cerrá o revirté la consignación primero." });
    return;
  }
  if (device.repairRecords.length > 0) {
    res.status(400).json({ message: "No se puede eliminar: el equipo está en reparación. Dalo de vuelta desde técnico primero." });
    return;
  }
  await prisma.$transaction([
    prisma.repairRecord.deleteMany({ where: { deviceId } }),
    prisma.device.delete({ where: { id: deviceId } })
  ]);
  await writeAuditLog({
    actorId,
    action: "device.deleted",
    entityType: "device",
    entityId: deviceId,
    meta: { imei: device.imei }
  });
  res.status(204).send();
});
