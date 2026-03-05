import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const stockRouter = Router();
stockRouter.use(requireAuth);

stockRouter.get("/catalog", async (_req, res) => {
  const categories = await prisma.productCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      offers: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { label: "asc" }
          }
        }
      }
    }
  });
  res.json({ categories });
});

stockRouter.post("/catalog/categories", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2),
      slug: z.string().trim().min(2),
      sortOrder: z.number().int().min(0).max(9999).default(100)
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const category = await prisma.productCategory.create({ data: parsed.data });
  res.status(201).json({ category });
});

stockRouter.post("/catalog/offers", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      categoryId: z.string().uuid(),
      name: z.string().trim().min(2),
      brand: z.string().trim().optional(),
      description: z.string().trim().optional()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const offer = await prisma.productOffer.create({ data: parsed.data });
  res.status(201).json({ offer });
});

stockRouter.post("/catalog/variants", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      offerId: z.string().uuid(),
      label: z.string().trim().min(2),
      memory: z.string().trim().optional(),
      color: z.string().trim().optional(),
      sku: z.string().trim().optional(),
      isSellableWithoutStock: z.boolean().default(true)
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const variant = await prisma.productVariant.create({ data: parsed.data });
  res.status(201).json({ variant });
});

stockRouter.get("/requests", async (req, res) => {
  const where =
    req.user!.role === "admin"
      ? {}
      : {
          reseller: { userId: req.user!.id }
        };
  const requests = await prisma.stockRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      reseller: { include: { user: true } },
      variant: { include: { offer: true } }
    },
    take: 200
  });
  res.json({ requests });
});

/** Historial de tareas/encargues realizados (registro con fecha de creación y de cierre). Solo admin. */
stockRouter.get("/requests/completed", requireRole("admin"), async (_req, res) => {
  const list = await prisma.stockRequest.findMany({
    where: { status: "completed" },
    orderBy: { resolvedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      note: true,
      quantity: true,
      createdAt: true,
      resolvedAt: true,
      resolvedNote: true,
      reseller: { select: { user: { select: { name: true } } } }
    }
  });
  res.json({
    completed: list.map((r) => ({
      id: r.id,
      title: r.title,
      note: r.note,
      quantity: r.quantity,
      resellerName: r.reseller.user.name,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolvedNote: r.resolvedNote ?? null
    }))
  });
});

stockRouter.post("/requests", requireRole("reseller", "admin"), async (req, res) => {
  const parsed = z
    .object({
      resellerId: z.string().uuid().optional(),
      variantId: z.string().uuid().optional(),
      title: z.string().trim().min(2),
      note: z.string().trim().optional(),
      quantity: z.number().int().min(1).max(500).default(1)
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }

  const resellerId =
    req.user!.role === "admin"
      ? parsed.data.resellerId
      : req.user!.resellerId;

  if (!resellerId) {
    res.status(400).json({ message: "ResellerId requerido para crear solicitud." });
    return;
  }

  const created = await prisma.stockRequest.create({
    data: {
      resellerId,
      variantId: parsed.data.variantId,
      title: parsed.data.title,
      note: parsed.data.note,
      quantity: parsed.data.quantity
    },
    include: {
      reseller: { include: { user: true } },
      variant: { include: { offer: true } }
    }
  });

  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "stock_request_pending",
        title: "Nueva solicitud pendiente de aprobación",
        body: `${created.reseller.user.name} solicitó ${created.quantity} x ${created.title}.`
      }))
    });
  }

  res.status(201).json({ request: created });
});

/** Editar tarea (solo admin): pendiente o realizada (en realizada se puede editar también resolvedNote). */
stockRouter.patch("/requests/:id", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  const parsed = z
    .object({
      resellerId: z.string().uuid().optional(),
      resellerName: z.string().trim().min(1).max(200).optional(),
      title: z.string().trim().min(1).max(500).optional(),
      note: z.string().trim().max(2000).optional(),
      quantity: z.number().int().min(1).max(500).optional(),
      resolvedNote: z.string().trim().max(2000).optional()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Datos inválidos." });
    return;
  }
  const existing = await prisma.stockRequest.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Solicitud no encontrada." });
    return;
  }
  if (existing.status !== "pending_approval" && existing.status !== "completed") {
    res.status(400).json({ message: "Solo se pueden editar tareas pendientes o realizadas." });
    return;
  }
  const data: { resellerId?: string; title?: string; note?: string | null; quantity?: number; resolvedNote?: string | null } = {};
  if (parsed.data.resellerName !== undefined) {
    const byName = await prisma.reseller.findFirst({
      where: { user: { name: parsed.data.resellerName } }
    });
    if (!byName) {
      res.status(400).json({ message: "No se encontró un revendedor con ese nombre." });
      return;
    }
    data.resellerId = byName.id;
  } else if (parsed.data.resellerId !== undefined) {
    data.resellerId = parsed.data.resellerId;
  }
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.note !== undefined) data.note = parsed.data.note || null;
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity;
  if (existing.status === "completed" && parsed.data.resolvedNote !== undefined) data.resolvedNote = parsed.data.resolvedNote || null;
  const updated = await prisma.stockRequest.update({
    where: { id },
    data,
    include: { reseller: { include: { user: true } } }
  });
  res.json({ request: updated });
});

stockRouter.post("/requests/:id/status", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["pending_approval", "approved", "rejected", "cancelled", "completed"]),
      resolvedNote: z.string().trim().max(2000).optional()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Estado inválido." });
    return;
  }
  const requestId = String(req.params.id);
  const data: { status: string; resolvedAt: Date | null; resolvedById: string | null; resolvedNote?: string | null } = {
    status: parsed.data.status,
    resolvedAt: parsed.data.status === "pending_approval" ? null : new Date(),
    resolvedById: parsed.data.status === "pending_approval" ? null : req.user!.id
  };
  if (parsed.data.status === "completed" && parsed.data.resolvedNote !== undefined) {
    data.resolvedNote = parsed.data.resolvedNote || null;
  }
  const updated = await prisma.stockRequest.update({
    where: { id: requestId },
    data,
    include: { reseller: { include: { user: true } } }
  });

  const statusLabel =
    parsed.data.status === "completed"
      ? "realizada"
      : parsed.data.status === "cancelled"
        ? "cancelada"
        : parsed.data.status;
  await prisma.notification.create({
    data: {
      userId: updated.reseller.userId,
      type: "stock_request_status",
      title: "Actualización de solicitud",
      body:
        parsed.data.status === "completed"
          ? `Tu tarea "${updated.title}" fue marcada como realizada.`
          : parsed.data.status === "cancelled"
            ? `La tarea "${updated.title}" fue eliminada del listado.`
            : `Tu solicitud "${updated.title}" fue marcada como ${statusLabel}.`
    }
  });

  res.json({ request: updated });
});

