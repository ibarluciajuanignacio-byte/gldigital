import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit.js";
import { parsePagination } from "../lib/pagination.js";
import { getDebtBalanceCents } from "../services/ledger.js";

export const resellersRouter = Router();
resellersRouter.use(requireAuth);

resellersRouter.get("/", requireRole("admin"), async (_req, res) => {
  const { skip, take, page, pageSize } = parsePagination(
    _req.query as Record<string, string | string[]>
  );
  const [resellers, total] = await Promise.all([
    prisma.reseller.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.reseller.count()
  ]);
  const withSummary = await Promise.all(
    resellers.map(async (r) => {
      const [debtBalanceCents, consignmentsCount] = await Promise.all([
        getDebtBalanceCents(r.id),
        prisma.consignment.count({ where: { resellerId: r.id, status: "active" } })
      ]);
      return {
        ...r,
        debtBalanceCents,
        consignmentsCount
      };
    })
  );
  res.json({ resellers: withSummary, meta: { page, pageSize, total } });
});

resellersRouter.post("/", requireRole("admin"), async (req, res) => {
  const input = req.body as {
    name: string;
    email: string;
    password: string;
    segment?: string;
    companyName?: string;
    birthday?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: "reseller",
      passwordHash
    }
  });
  const reseller = await prisma.reseller.create({
    data: {
      userId: user.id,
      segment: input.segment,
      companyName: input.companyName,
      birthday: input.birthday ? new Date(input.birthday) : undefined,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude
    },
    include: { user: true }
  });

  await writeAuditLog({
    actorId: req.user!.id,
    action: "reseller.created",
    entityType: "reseller",
    entityId: reseller.id
  });

  res.status(201).json({ reseller });
});

resellersRouter.patch("/:id/profile", requireRole("admin"), async (req, res) => {
  const resellerId = String(req.params.id);
  const parsed = z
    .object({
      segment: z.string().trim().optional(),
      companyName: z.string().trim().optional(),
      birthday: z.string().datetime().optional().nullable(),
      city: z.string().trim().optional(),
      address: z.string().trim().optional(),
      latitude: z.number().min(-90).max(90).optional().nullable(),
      longitude: z.number().min(-180).max(180).optional().nullable()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const payload = parsed.data;
  const reseller = await prisma.reseller.update({
    where: { id: resellerId },
    data: {
      segment: payload.segment,
      companyName: payload.companyName,
      birthday: payload.birthday === null ? null : payload.birthday ? new Date(payload.birthday) : undefined,
      city: payload.city,
      address: payload.address,
      latitude: payload.latitude === null ? null : payload.latitude,
      longitude: payload.longitude === null ? null : payload.longitude
    },
    include: { user: true }
  });
  res.json({ reseller });
});

resellersRouter.post("/:id/geocode", requireRole("admin"), async (req, res) => {
  const resellerId = String(req.params.id);
  const reseller = await prisma.reseller.findUnique({ where: { id: resellerId } });
  if (!reseller) {
    res.status(404).json({ message: "Revendedor no encontrado." });
    return;
  }
  const query = [reseller.address, reseller.city].filter(Boolean).join(", ").trim();
  if (!query) {
    res.status(400).json({ message: "No hay dirección/ciudad para geocodificar." });
    return;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const r = await fetch(url, { headers: { "user-agent": "GLdigital/1.0" } });
  if (!r.ok) {
    res.status(502).json({ message: "No se pudo geocodificar en este momento." });
    return;
  }
  const data = (await r.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) {
    res.status(404).json({ message: "No se encontró coordenada para esa dirección." });
    return;
  }
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  const updated = await prisma.reseller.update({
    where: { id: resellerId },
    data: { latitude, longitude },
    include: { user: true }
  });
  res.json({ reseller: updated });
});

resellersRouter.get("/map/overview", requireRole("admin"), async (_req, res) => {
  const resellers = await prisma.reseller.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  const points = await Promise.all(
    resellers.map(async (r) => {
      const [devicesCount, consignmentsCount, debtBalanceCents] = await Promise.all([
        prisma.device.count({ where: { resellerId: r.id } }),
        prisma.consignment.count({ where: { resellerId: r.id, status: "active" } }),
        getDebtBalanceCents(r.id)
      ]);
      return {
        resellerId: r.id,
        name: r.user.name,
        companyName: r.companyName,
        city: r.city,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        devicesCount,
        consignmentsCount,
        debtBalanceCents
      };
    })
  );

  res.json({ points });
});

resellersRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const resellerId = String(req.params.id);
  const reseller = await prisma.reseller.findUnique({
    where: { id: resellerId },
    include: { user: true }
  });
  if (!reseller) {
    res.status(404).json({ error: "Revendedor no encontrado" });
    return;
  }
  const userId = reseller.userId;

  await prisma.$transaction(async (tx) => {
    await tx.device.updateMany({ where: { resellerId }, data: { resellerId: null, state: "available" } });
    await tx.client.updateMany({ where: { resellerId }, data: { resellerId: null } });
    const consignmentIds = (await tx.consignment.findMany({ where: { resellerId }, select: { id: true } })).map((c) => c.id);
    if (consignmentIds.length) {
      await tx.consignmentMovement.deleteMany({ where: { consignmentId: { in: consignmentIds } } });
      await tx.consignment.deleteMany({ where: { resellerId } });
    }
    await tx.debtLedgerEntry.deleteMany({ where: { resellerId } });
    await tx.payment.deleteMany({ where: { resellerId } });
    await tx.stockRequest.deleteMany({ where: { resellerId } });
    await tx.reseller.delete({ where: { id: resellerId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await writeAuditLog({
    actorId: req.user!.id,
    action: "reseller.deleted",
    entityType: "reseller",
    entityId: resellerId
  });

  res.status(204).send();
});

resellersRouter.get("/:id/profile", requireRole("admin"), async (req, res) => {
  const resellerId = String(req.params.id);
  const reseller = await prisma.reseller.findUnique({
    where: { id: resellerId },
    include: { user: true }
  });

  if (!reseller) {
    res.status(404).json({ error: "Revendedor no encontrado" });
    return;
  }

  const [consignments, payments, debtEntries, dmConversation, debtBalanceCents] = await Promise.all([
    prisma.consignment.findMany({
      where: { resellerId },
      include: {
        device: {
          include: {
            purchaseOrderItem: { select: { displayModel: true } }
          }
        },
        movements: true
      },
      orderBy: { assignedAt: "desc" },
      take: 60
    }),
    prisma.payment.findMany({
      where: { resellerId },
      include: {
        reportedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 60
    }),
    prisma.debtLedgerEntry.findMany({
      where: { resellerId },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.chatConversation.findFirst({
      where: {
        type: "dm",
        AND: [
          { members: { some: { userId: req.user!.id } } },
          { members: { some: { userId: reseller.userId } } }
        ]
      },
      select: { id: true }
    }),
    getDebtBalanceCents(resellerId)
  ]);

  res.json({
    reseller,
    summary: {
      debtBalanceCents,
      consignmentsCount: consignments.length,
      paymentsCount: payments.length,
      debtEntriesCount: debtEntries.length
    },
    consignments,
    payments,
    debtEntries,
    chat: {
      dmConversationId: dmConversation?.id ?? null
    }
  });
});
