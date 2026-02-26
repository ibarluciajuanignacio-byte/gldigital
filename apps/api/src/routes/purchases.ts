import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getDisplayLabel, isValidModelMemoryColor } from "../data/phoneCatalog.js";

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth);
purchasesRouter.use(requireRole("admin"));

const createOrderSchema = z.object({
  supplierId: z.string().uuid(),
  currency: z.enum(["USD", "ARS"]).default("USD"),
  totalAmountCents: z.union([z.number().int().min(0), z.string().transform((v) => (v === "" ? undefined : Math.round(Number(v))))]).optional(),
  shippingCostCents: z.union([z.number().int().min(0), z.coerce.number().transform((n) => Math.max(0, Math.round(n)))]).default(0),
  notes: z.string().trim().optional()
});

const addItemSchema = z.object({
  model: z.string().trim().min(1, "Seleccioná el modelo."),
  displayModel: z.string().trim().min(1).optional(), // ej. "iPhone 14" o "iPhone 14 Plus"
  memory: z.string().trim().min(1, "Seleccioná la memoria."),
  color: z.string().trim().min(1, "Seleccioná el color."),
  quantityExpected: z.number().int().min(1).default(1),
  unitCostCents: z.number().int().min(0).optional()
});

const updateItemSchema = z.object({
  quantityExpected: z.number().int().min(1).optional(),
  unitCostCents: z.number().int().min(0).optional()
});

const receiveByImeiSchema = z.object({
  imei: z.string().trim().min(1),
  purchaseOrderItemId: z.string().uuid(),
  model: z.string().trim().optional(),
  color: z.string().trim().optional(),
  memory: z.string().trim().optional(),
  condition: z.enum(["sealed", "used"]).default("sealed")
});

// Unidades pendientes de escanear (órdenes de compra con quantityReceived < quantityExpected)
purchasesRouter.get("/pending-to-scan", async (req, res) => {
  const items = await prisma.purchaseOrderItem.findMany({
    select: { quantityExpected: true, quantityReceived: true }
  });
  const pendingToScan = items.reduce(
    (sum, i) => sum + Math.max(0, (i.quantityExpected ?? 0) - (i.quantityReceived ?? 0)),
    0
  );
  res.json({ pendingToScan });
});

// Ítems de órdenes de compra con unidades pendientes de escanear (para listar en inventario)
purchasesRouter.get("/pending-items", async (req, res) => {
  const items = await prisma.purchaseOrderItem.findMany({
    include: {
      purchaseOrder: { select: { id: true, orderNumber: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const pendingItems = items
    .filter((i) => (i.quantityExpected ?? 0) > (i.quantityReceived ?? 0))
    .map((i) => ({
      id: i.id,
      orderId: i.purchaseOrder.id,
      orderNumber: i.purchaseOrder.orderNumber,
      modelLabel: i.modelLabel,
      model: i.model,
      displayModel: i.displayModel,
      memory: i.memory,
      color: i.color,
      quantityExpected: i.quantityExpected ?? 0,
      quantityReceived: i.quantityReceived ?? 0,
      pending: Math.max(0, (i.quantityExpected ?? 0) - (i.quantityReceived ?? 0))
    }));
  res.json({ pendingItems });
});

// Recepción por IMEI (ruta fija antes de /:id para que no se confunda con id)
purchasesRouter.post("/receive-by-imei", async (req, res) => {
  const parsed = receiveByImeiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const imei = parsed.data.imei.replace(/\s/g, "");
  const existing = await prisma.device.findUnique({ where: { imei } });
  if (existing) {
    res.status(400).json({ message: "El IMEI ya existe en el inventario" });
    return;
  }
  const item = await prisma.purchaseOrderItem.findUnique({
    where: { id: parsed.data.purchaseOrderItemId },
    include: { purchaseOrder: { include: { items: true } } }
  });
  if (!item) {
    res.status(404).json({ message: "Línea de orden no encontrada" });
    return;
  }
  if (item.quantityReceived >= item.quantityExpected) {
    res.status(400).json({ message: "Ya se recibió la cantidad esperada para esta línea" });
    return;
  }
  const order = item.purchaseOrder;
  const totalExpected = order.items.reduce((sum, i) => sum + i.quantityExpected, 0);
  const shippingPerUnitCents =
    totalExpected > 0 && order.shippingCostCents
      ? Math.round(order.shippingCostCents / totalExpected)
      : 0;
  const unitCostCents = (item.unitCostCents ?? 0) + shippingPerUnitCents;

  const deviceModel = parsed.data.model ?? item.model ?? item.modelLabel;
  const deviceMemory = parsed.data.memory ?? item.memory ?? null;
  const deviceColor = parsed.data.color ?? item.color ?? null;

  const device = await prisma.$transaction(async (tx) => {
    const isSealed = parsed.data.condition === "sealed";
    const d = await tx.device.create({
      data: {
        imei,
        model: deviceModel,
        modelDisplay: item.displayModel ?? null,
        memory: deviceMemory,
        color: deviceColor,
        condition: parsed.data.condition,
        state: "available",
        sourceType: "purchase",
        purchaseOrderItemId: item.id,
        costCents: unitCostCents,
        ...(isSealed && {
          batteryHealth: 100,
          batteryCycles: 0,
          warrantyStatus: "1 año"
        })
      }
    });
    await tx.purchaseOrderItem.update({
      where: { id: item.id },
      data: { quantityReceived: item.quantityReceived + 1 }
    });
    const totalReceived = item.quantityReceived + 1;
    const allReceived = totalReceived >= item.quantityExpected;
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        statusPhysical: allReceived ? "received" : "partial"
      }
    });
    return d;
  });
  res.status(201).json({ device });
});

// Listar órdenes de compra
purchasesRouter.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const supplierId = req.query.supplierId as string | undefined;
  const where: Record<string, unknown> = {};
  if (supplierId) where.supplierId = supplierId;
  if (status) where.statusPayment = status;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      items: { include: { _count: { select: { devices: true } } } }
    },
    take: 100
  });
  res.json({ orders });
});

// Obtener una orden
purchasesRouter.get("/:id", async (req, res) => {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: true,
      items: { include: { devices: true } }
    }
  });
  if (!order) {
    res.status(404).json({ message: "Orden no encontrada" });
    return;
  }
  res.json({ order });
});

// Eliminar orden de compra (desvincula dispositivos del ítem, borra ítems y la orden)
purchasesRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { select: { id: true } } }
  });
  if (!order) {
    res.status(404).json({ error: "Orden no encontrada" });
    return;
  }
  const itemIds = order.items.map((i) => i.id);
  await prisma.$transaction(async (tx) => {
    if (itemIds.length) {
      await tx.device.updateMany({
        where: { purchaseOrderItemId: { in: itemIds } },
        data: { purchaseOrderItemId: null }
      });
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }
    await tx.purchaseOrder.delete({ where: { id } });
  });
  res.status(204).send();
});

// Crear orden de compra
purchasesRouter.post("/", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? (first ? `${first.path.join(".")}: inválido` : "Datos inválidos");
    res.status(400).json({ message: msg });
    return;
  }
  const count = await prisma.purchaseOrder.count();
  const orderNumber = `OC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`;
  try {
    const rawTotal = parsed.data.totalAmountCents;
    const totalAmountCents =
      rawTotal !== undefined && rawTotal !== null && Number.isFinite(rawTotal) && rawTotal >= 0 ? Math.round(Number(rawTotal)) : undefined;
    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId: parsed.data.supplierId,
        currency: parsed.data.currency,
        orderNumber,
        shippingCostCents: parsed.data.shippingCostCents ?? 0,
        totalAmountCents,
        notes: parsed.data.notes
      },
      include: { supplier: true, items: true }
    });
    res.status(201).json({ order });
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Error al crear la orden";
    res.status(500).json({ message });
  }
});

// Añadir ítem a la orden (modelo + memoria + color del catálogo)
purchasesRouter.post("/:id/items", async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const { model, memory, color, quantityExpected, unitCostCents, displayModel } = parsed.data;
  if (!isValidModelMemoryColor(model, memory, color)) {
    res.status(400).json({ message: "Combinación modelo / memoria / color no válida según el catálogo." });
    return;
  }
  const modelLabel = getDisplayLabel(displayModel ?? model, memory, color);
  const item = await prisma.purchaseOrderItem.create({
    data: {
      purchaseOrderId: req.params.id,
      modelLabel,
      displayModel: displayModel ?? null,
      model,
      memory,
      color,
      quantityExpected,
      unitCostCents
    }
  });
  res.status(201).json({ item });
});

// Actualizar ítem (cantidad esperada y/o costo unitario)
purchasesRouter.patch("/:id/items/:itemId", async (req, res) => {
  const orderId = req.params.id;
  const itemId = req.params.itemId;
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const item = await prisma.purchaseOrderItem.findFirst({
    where: { id: itemId, purchaseOrderId: orderId }
  });
  if (!item) {
    res.status(404).json({ message: "Ítem no encontrado en esta orden" });
    return;
  }
  const quantityReceived = item.quantityReceived ?? 0;
  const updates: { quantityExpected?: number; unitCostCents?: number | null } = {};
  if (parsed.data.quantityExpected !== undefined) {
    if (parsed.data.quantityExpected < quantityReceived) {
      res.status(400).json({
        message: `No se puede reducir la cantidad esperada por debajo de las unidades ya recibidas (${quantityReceived})`
      });
      return;
    }
    updates.quantityExpected = parsed.data.quantityExpected;
  }
  if (parsed.data.unitCostCents !== undefined) {
    updates.unitCostCents = parsed.data.unitCostCents;
  }
  if (Object.keys(updates).length === 0) {
    res.json({ item });
    return;
  }
  const updated = await prisma.purchaseOrderItem.update({
    where: { id: itemId },
    data: updates
  });
  res.json({ item: updated });
});

// Eliminar ítem (solo si no tiene unidades recibidas)
purchasesRouter.delete("/:id/items/:itemId", async (req, res) => {
  const orderId = req.params.id;
  const itemId = req.params.itemId;
  const item = await prisma.purchaseOrderItem.findFirst({
    where: { id: itemId, purchaseOrderId: orderId }
  });
  if (!item) {
    res.status(404).json({ message: "Ítem no encontrado en esta orden" });
    return;
  }
  if ((item.quantityReceived ?? 0) > 0) {
    res.status(400).json({
      message: "No se puede eliminar el ítem porque ya tiene unidades recibidas. Solo se pueden eliminar líneas sin recepciones."
    });
    return;
  }
  await prisma.purchaseOrderItem.delete({ where: { id: itemId } });
  res.status(204).send();
});
