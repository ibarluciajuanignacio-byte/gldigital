import { Router } from "express";
import { createConversationSchema, sendMessageSchema } from "@gldigital/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getIo } from "../sockets/index.js";

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get("/conversations", async (req, res) => {
  const conversations = await prisma.chatConversation.findMany({
    where: { members: { some: { userId: req.user!.id } } },
    include: {
      members: { include: { user: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { attachments: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const withUnread = await Promise.all(
    conversations.map(async (conversation) => {
      const currentMember = conversation.members.find((m) => m.userId === req.user!.id);
      const unreadCount = await prisma.chatMessage.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: req.user!.id },
          ...(currentMember?.lastReadMessageId
            ? {
                createdAt: {
                  gt:
                    (await prisma.chatMessage.findUnique({
                      where: { id: currentMember.lastReadMessageId },
                      select: { createdAt: true }
                    }))?.createdAt ?? new Date(0)
                }
              }
            : {})
        }
      });
      return { ...conversation, unreadCount };
    })
  );

  res.json({ conversations: withUnread });
});

chatRouter.post("/dm/by-reseller/:resellerId", requireRole("admin"), async (req, res) => {
  const resellerId = String(req.params.resellerId);
  const reseller = await prisma.reseller.findUnique({
    where: { id: resellerId },
    include: { user: true }
  });
  if (!reseller) {
    res.status(404).json({ error: "Revendedor no encontrado" });
    return;
  }

  const actorId = String(req.user!.id);
  const otherUserId = reseller.userId;

  const existing = await prisma.chatConversation.findFirst({
    where: {
      type: "dm",
      AND: [
        { members: { some: { userId: actorId } } },
        { members: { some: { userId: otherUserId } } }
      ]
    },
    select: { id: true }
  });

  if (existing) {
    res.json({ conversationId: existing.id, created: false });
    return;
  }

  const conversation = await prisma.chatConversation.create({
    data: {
      type: "dm",
      createdById: actorId,
      members: {
        create: [{ userId: actorId }, { userId: otherUserId }]
      }
    },
    select: { id: true }
  });

  await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      kind: "system",
      body: "Conversación iniciada desde ficha de revendedor."
    }
  });

  res.status(201).json({ conversationId: conversation.id, created: true });
});

chatRouter.post("/conversations", requireRole("admin"), async (req, res) => {
  const input = createConversationSchema.parse(req.body);
  const actorId = String(req.user!.id);
  const memberIds = [...new Set([...input.memberIds, actorId])];
  const users = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, role: true }
  });
  if (users.length !== memberIds.length) {
    res.status(400).json({ error: "Hay usuarios inválidos en la conversación" });
    return;
  }
  if (input.type === "dm" && memberIds.length !== 2) {
    res.status(400).json({ error: "Una conversación DM debe tener exactamente 2 miembros" });
    return;
  }

  const conversation = await prisma.chatConversation.create({
    data: {
      type: input.type,
      name: input.name,
      createdById: actorId,
      members: { create: memberIds.map((userId) => ({ userId })) },
      group: input.type === "group" && input.name
        ? { create: { label: input.name } }
        : undefined
    },
    include: { members: true }
  });

  res.status(201).json({ conversation });
});

chatRouter.get("/conversations/:id/messages", async (req, res) => {
  const conversationId = String(req.params.id);
  const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 50), 100);
  const beforeId = typeof req.query.beforeId === "string" ? req.query.beforeId : undefined;

  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { members: { include: { user: true } } }
  });
  if (!conv) {
    res.status(404).json({ error: "Conversación no encontrada" });
    return;
  }
  const member = conv.members.find((m) => m.userId === req.user!.id);
  if (!member) {
    res.status(403).json({ error: "No autorizado en esta conversación" });
    return;
  }

  const raw = await prisma.chatMessage.findMany({
    where: { conversationId },
    include: { attachments: true, sender: true },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(beforeId ? { cursor: { id: beforeId }, skip: 1 } : {})
  });
  const hasMore = raw.length > limit;
  const messages = raw.slice(0, limit).reverse();

  let otherMemberLastReadMessageId: string | null = null;
  if (conv.type === "dm") {
    const other = conv.members.find((m) => m.userId !== req.user!.id);
    if (other?.lastReadMessageId) otherMemberLastReadMessageId = other.lastReadMessageId;
  }

  res.json({ messages, otherMemberLastReadMessageId, hasMore });
});

chatRouter.post("/messages", async (req, res) => {
  const input = sendMessageSchema.parse(req.body);
  const membership = await prisma.chatMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: input.conversationId,
        userId: req.user!.id
      }
    }
  });
  if (!membership) {
    res.status(403).json({ error: "No autorizado en esta conversación" });
    return;
  }

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: input.conversationId,
      senderId: req.user!.id,
      body: input.body,
      attachments: {
        create: input.attachmentKeys.map((key) => ({
          objectKey: key,
          mimeType: "image/*",
          sizeBytes: 0
        }))
      }
    },
    include: { attachments: true, sender: true }
  });

  getIo().to(`conversation:${input.conversationId}`).emit("chat:message", message);

  res.status(201).json({ message });
});

chatRouter.post("/conversations/:id/mark-read", async (req, res) => {
  const conversationId = String(req.params.id);
  const { lastReadMessageId } = req.body as { lastReadMessageId: string };
  const member = await prisma.chatMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: req.user!.id
      }
    }
  });
  if (!member) {
    res.status(403).json({ error: "No autorizado en esta conversación" });
    return;
  }
  await prisma.chatMember.update({
    where: { id: member.id },
    data: { lastReadMessageId }
  });
  getIo()
    .to(`conversation:${conversationId}`)
    .emit("chat:read", { userId: req.user!.id, lastReadMessageId });
  res.json({ ok: true });
});
