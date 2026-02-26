import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json({ notifications });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { isRead: true }
  });
  res.json({ updated: notification.count });
});

notificationsRouter.get("/birthdays/upcoming", async (req, res) => {
  const days = Math.min(30, Math.max(1, Number(req.query.days ?? 14)));
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();

  const [resellers, clients] = await Promise.all([
    prisma.reseller.findMany({
      where: { birthday: { not: null } },
      include: { user: true }
    }),
    prisma.client.findMany({
      where: { birthday: { not: null } },
      include: { reseller: { include: { user: true } } }
    })
  ]);

  function daysUntil(birthday: Date): number {
    const target = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
    if (target < today) target.setFullYear(target.getFullYear() + 1);
    const diffMs = target.getTime() - new Date(today.getFullYear(), currentMonth, currentDate).getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  const upcoming = [
    ...resellers.map((r) => ({
      kind: "reseller" as const,
      id: r.id,
      name: r.user.name,
      birthday: r.birthday!,
      daysLeft: daysUntil(r.birthday!),
      owner: null as string | null
    })),
    ...clients.map((c) => ({
      kind: "client" as const,
      id: c.id,
      name: c.name,
      birthday: c.birthday!,
      daysLeft: daysUntil(c.birthday!),
      owner: c.reseller?.user.name ?? null
    }))
  ]
    .filter((i) => i.daysLeft >= 0 && i.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));

  res.json({ upcoming, days });
});
