import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/bootstrap", async (_req, res) => {
  const adminEmail = "admin@gldigital.local";
  const resellerEmail = "revendedor@gldigital.local";

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const resellerPasswordHash = await bcrypt.hash("revendedor123", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash, role: "admin", name: "Admin GLdigital" },
    create: {
      email: adminEmail,
      name: "Admin GLdigital",
      role: "admin",
      passwordHash: adminPasswordHash
    }
  });

  const resellerUser = await prisma.user.upsert({
    where: { email: resellerEmail },
    update: { passwordHash: resellerPasswordHash, role: "reseller", name: "Revendedor Demo" },
    create: {
      email: resellerEmail,
      name: "Revendedor Demo",
      role: "reseller",
      passwordHash: resellerPasswordHash
    }
  });

  await prisma.reseller.upsert({
    where: { userId: resellerUser.id },
    update: { segment: "premium", companyName: "Revendedor Demo" },
    create: { userId: resellerUser.id, segment: "premium", companyName: "Revendedor Demo" }
  });

  const defaultStatuses = [
    { key: "available", name: "Disponible en oficina", sector: "office", isSellable: true, isVisibleForReseller: true, sortOrder: 10 },
    { key: "reserved", name: "Reservado", sector: "reservations", isSellable: false, isVisibleForReseller: false, sortOrder: 20 },
    { key: "consigned", name: "En consignación", sector: "consignment", isSellable: false, isVisibleForReseller: false, sortOrder: 30 },
    { key: "sold", name: "Vendido", sector: "orders", isSellable: false, isVisibleForReseller: false, sortOrder: 40 },
    { key: "returned", name: "Devuelto", sector: "office", isSellable: false, isVisibleForReseller: false, sortOrder: 50 }
  ];
  for (const s of defaultStatuses) {
    await prisma.deviceStatus.upsert({
      where: { key: s.key },
      update: s,
      create: s
    });
  }

  const categories = [
    { name: "iPhone", slug: "iphone", sortOrder: 1 },
    { name: "iPad", slug: "ipad", sortOrder: 2 },
    { name: "MacBook", slug: "macbook", sortOrder: 3 },
    { name: "Consolas", slug: "consolas", sortOrder: 4 },
    { name: "Accesorios", slug: "accesorios", sortOrder: 5 }
  ];
  for (const c of categories) {
    await prisma.productCategory.upsert({
      where: { slug: c.slug },
      update: c,
      create: c
    });
  }

  // Ensure a DM conversation exists for admin and default reseller (no fallar bootstrap si falla el chat).
  try {
    const existingDm = await prisma.chatConversation.findFirst({
      where: {
        type: "dm",
        members: {
          some: { userId: admin.id }
        }
      },
      include: { members: true }
    });

    if (!existingDm || !existingDm.members.some((m) => m.userId === resellerUser.id)) {
      const dm = await prisma.chatConversation.create({
        data: {
          type: "dm",
          createdById: admin.id,
          members: {
            create: [{ userId: admin.id }, { userId: resellerUser.id }]
          }
        }
      });
      await prisma.chatMessage.create({
        data: {
          conversationId: dm.id,
          kind: "system",
          body: "Conversación inicial creada automáticamente."
        }
      });
    }
  } catch (chatErr) {
    console.warn("[bootstrap] Chat inicial omitido:", chatErr);
  }

  res.json({ ok: true });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const reseller = user.role === "reseller"
    ? await prisma.reseller.findUnique({ where: { userId: user.id } })
    : null;

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    resellerId: reseller?.id
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      resellerId: reseller?.id
    }
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  res.json({ user });
});
