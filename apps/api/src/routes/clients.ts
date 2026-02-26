import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get("/", async (req, res) => {
  const where =
    req.user!.role === "admin"
      ? {}
      : {
          OR: [{ reseller: { userId: req.user!.id } }, { resellerId: null }]
        };
  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { reseller: { include: { user: true } } },
    take: 300
  });
  res.json({ clients });
});

clientsRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = z
    .object({
      resellerId: z.string().uuid().optional(),
      name: z.string().trim().min(2),
      email: z.string().email().optional(),
      phone: z.string().trim().optional(),
      birthday: z.string().datetime().optional(),
      city: z.string().trim().optional(),
      address: z.string().trim().optional()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const client = await prisma.client.create({
    data: {
      ...parsed.data,
      birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : undefined
    }
  });
  res.status(201).json({ client });
});

