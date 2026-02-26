import { MessageKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/index.js";

export async function postSystemMessage(input: {
  conversationId: string;
  body: string;
}): Promise<void> {
  const message = await prisma.chatMessage.create({
    data: {
      conversationId: input.conversationId,
      kind: MessageKind.system,
      body: input.body
    }
  });

  getIo().to(`conversation:${input.conversationId}`).emit("chat:message", message);
}

export async function createSystemMessageForReseller(input: {
  resellerId: string;
  body: string;
}): Promise<void> {
  const reseller = await prisma.reseller.findUnique({
    where: { id: input.resellerId },
    include: { user: true }
  });
  if (!reseller) return;

  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) return;

  const dmConversation = await prisma.chatConversation.findFirst({
    where: {
      type: "dm",
      members: {
        every: {
          userId: {
            in: [admin.id, reseller.user.id]
          }
        }
      }
    }
  });

  if (!dmConversation) return;
  await postSystemMessage({ conversationId: dmConversation.id, body: input.body });
}
