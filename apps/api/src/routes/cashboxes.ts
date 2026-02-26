import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const cashboxesRouter = Router();
cashboxesRouter.use(requireAuth);
cashboxesRouter.use(requireRole("admin"));

const createBoxSchema = z.object({
  name: z.string().trim().min(1),
  currency: z.enum(["USD", "ARS", "USDT"]).default("USD"),
  type: z.enum(["general", "petty", "crypto"]).default("general")
});

const createMovementSchema = z.object({
  cashBoxId: z.string().uuid(),
  type: z.enum(["credit", "debit"]),
  amountCents: z.number().int().min(1),
  currency: z.string().default("USD"),
  description: z.string().trim().min(1),
  referenceType: z.string().trim().optional(),
  referenceId: z.string().trim().optional()
});

cashboxesRouter.get("/", async (_req, res) => {
  const boxes = await prisma.cashBox.findMany({
    orderBy: { name: "asc" },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  const withBalance = await Promise.all(
    boxes.map(async (box) => {
      const movements = await prisma.cashMovement.findMany({
        where: { cashBoxId: box.id },
        orderBy: { createdAt: "desc" }
      });
      const balanceCents = movements.reduce(
        (sum, m) => sum + (m.type === "credit" ? m.amountCents : -m.amountCents),
        0
      );
      const last = movements[0] ?? null;
      return {
        ...box,
        balanceCents,
        lastMovement: last
          ? {
              description: last.description,
              createdAt: last.createdAt
            }
          : null
      };
    })
  );
  res.json({ boxes: withBalance });
});

cashboxesRouter.get("/:id", async (req, res) => {
  const box = await prisma.cashBox.findUnique({
    where: { id: req.params.id },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 100 }
    }
  });
  if (!box) {
    res.status(404).json({ message: "Caja no encontrada" });
    return;
  }
  const balanceCents = box.movements.reduce(
    (sum, m) => sum + (m.type === "credit" ? m.amountCents : -m.amountCents),
    0
  );
  res.json({ box: { ...box, balanceCents } });
});

cashboxesRouter.post("/", async (req, res) => {
  const parsed = createBoxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const box = await prisma.cashBox.create({ data: parsed.data });
  res.status(201).json({ box });
});

cashboxesRouter.post("/movements", async (req, res) => {
  const parsed = createMovementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const movement = await prisma.cashMovement.create({
    data: parsed.data
  });
  res.status(201).json({ movement });
});
