import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const techniciansRouter = Router();
techniciansRouter.use(requireAuth);
techniciansRouter.use(requireRole("admin"));

const createTechnicianSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal(""))
});

const updateTechnicianSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal(""))
});

// Listar técnicos
techniciansRouter.get("/", async (_req, res) => {
  const technicians = await prisma.technician.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { devices: true } } }
  });
  res.json({ technicians });
});

// Crear técnico
techniciansRouter.post("/", async (req, res) => {
  const parsed = createTechnicianSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const technician = await prisma.technician.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || undefined,
      email: parsed.data.email || undefined
    }
  });
  res.status(201).json({ technician });
});

// Actualizar técnico
techniciansRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  const parsed = updateTechnicianSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const technician = await prisma.technician.findUnique({ where: { id } });
  if (!technician) {
    res.status(404).json({ message: "Técnico no encontrado." });
    return;
  }
  const updated = await prisma.technician.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email || null })
    }
  });
  res.json({ technician: updated });
});

// Eliminar técnico (solo si no tiene equipos asignados)
techniciansRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const technician = await prisma.technician.findUnique({
    where: { id },
    include: { _count: { select: { devices: true } } }
  });
  if (!technician) {
    res.status(404).json({ message: "Técnico no encontrado." });
    return;
  }
  if (technician._count.devices > 0) {
    res.status(400).json({
      message: "No se puede eliminar el técnico porque tiene equipos asignados. Reasigná o quitá los equipos de técnico primero."
    });
    return;
  }
  await prisma.technician.delete({ where: { id } });
  res.status(204).send();
});
