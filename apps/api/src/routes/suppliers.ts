import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Razón social es obligatoria"),
  cuit: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().trim().optional(),
  currency: z.enum(["USD", "ARS"]).optional(),
  notes: z.string().trim().optional().nullable()
});

const updateSupplierSchema = createSupplierSchema.partial();

suppliersRouter.get("/", async (req, res) => {
  const q = (req.query.q as string)?.trim()?.toLowerCase();
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { cuit: { contains: q } },
          { email: { contains: q } }
        ]
      }
    : {};
  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseOrders: true } }
    }
  });
  res.json({ suppliers });
});

suppliersRouter.get("/:id", async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { items: true }
      }
    }
  });
  if (!supplier) {
    res.status(404).json({ message: "Proveedor no encontrado" });
    return;
  }
  res.json({ supplier });
});

suppliersRouter.post("/", async (req, res) => {
  const parsed = createSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const nameTrim = parsed.data.name.trim();
  if (nameTrim) {
    const existing = await prisma.supplier.findMany({ select: { name: true } });
    const duplicate = existing.some((s) => s.name.trim().toLowerCase() === nameTrim.toLowerCase());
    if (duplicate) {
      res.status(400).json({
        code: "DUPLICATE_SUPPLIER_NAME",
        message: "Ya existe un proveedor con ese nombre. Usá otro nombre o editá el existente en la ficha del proveedor."
      });
      return;
    }
  }
  const data = {
    ...parsed.data,
    email: parsed.data.email || undefined,
    notes: parsed.data.notes || undefined
  };
  const supplier = await prisma.supplier.create({ data });
  res.status(201).json({ supplier });
});

suppliersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const updateData = {
    ...parsed.data,
    email: parsed.data.email === "" ? null : parsed.data.email,
    notes: parsed.data.notes === "" ? null : parsed.data.notes
  };
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: updateData
  });
  res.json({ supplier });
});

suppliersRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { purchaseOrders: true } } }
  });
  if (!supplier) {
    res.status(404).json({ error: "Proveedor no encontrado" });
    return;
  }
  if ((supplier._count?.purchaseOrders ?? 0) > 0) {
    res.status(400).json({
      error: "No se puede eliminar: tiene órdenes de compra asociadas. Eliminá o reasigná las órdenes primero."
    });
    return;
  }
  await prisma.supplier.delete({ where: { id } });
  res.status(204).send();
});
