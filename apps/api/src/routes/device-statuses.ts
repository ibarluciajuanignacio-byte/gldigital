import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const deviceStatusesRouter = Router();
deviceStatusesRouter.use(requireAuth);

deviceStatusesRouter.get("/", async (req, res) => {
  const where =
    req.user!.role === "admin"
      ? {}
      : {
          isActive: true,
          isVisibleForReseller: true
        };
  const statuses = await prisma.deviceStatus.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  res.json({ statuses });
});

deviceStatusesRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      key: z.string().trim().min(2),
      name: z.string().trim().min(2),
      description: z.string().trim().optional(),
      sector: z.enum(["office", "consignment", "orders", "reservations"]).default("office"),
      isSellable: z.boolean().default(false),
      isVisibleForReseller: z.boolean().default(false),
      sortOrder: z.number().int().min(0).max(9999).default(100),
      isActive: z.boolean().default(true)
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const status = await prisma.deviceStatus.create({ data: parsed.data });
  res.status(201).json({ status });
});

deviceStatusesRouter.patch("/:key", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).optional(),
      description: z.string().trim().optional(),
      sector: z.enum(["office", "consignment", "orders", "reservations"]).optional(),
      isSellable: z.boolean().optional(),
      isVisibleForReseller: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
      isActive: z.boolean().optional()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const status = await prisma.deviceStatus.update({
    where: { key: String(req.params.key) },
    data: parsed.data
  });
  res.json({ status });
});

