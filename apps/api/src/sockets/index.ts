import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { AuthUser } from "../types/auth.js";
import { env } from "../lib/env.js";
import { verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

let ioInstance: Server | null = null;
const socketIdToUserId = new Map<string, string>();

export function createSocketServer(server: HttpServer): Server {
  const io = new Server(server, {
    cors: { origin: env.CORS_ORIGIN }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }
    try {
      const user = verifyToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthUser;
    socketIdToUserId.set(socket.id, user.id);
    (socket.data as { conversationIds?: Set<string> }).conversationIds = new Set<string>();
    socket.join(`user:${user.id}`);
    socket.join("chat:presence");
    const onlineUserIds = [...new Set(socketIdToUserId.values())];
    socket.emit("presence:global", { onlineUserIds });
    socket.to("chat:presence").emit("chat:user_online", { userId: user.id });
    let userName = "Usuario";
    try {
      const now = new Date();
      const u = await prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: now },
        select: { name: true }
      });
      if (u?.name) userName = u.name;
    } catch {
      /* ignore */
    }
    const heartbeat = setInterval(async () => {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() }
        });
      } catch {
        /* ignore */
      }
    }, 60_000);
    socket.on("disconnect", () => {
      clearInterval(heartbeat);
      socketIdToUserId.delete(socket.id);
      const stillOnlineForUser = [...socketIdToUserId.values()].includes(user.id);
      if (!stillOnlineForUser) {
        io.to("chat:presence").emit("chat:user_offline", { userId: user.id });
      }
      const cids = (socket.data as { conversationIds?: Set<string> }).conversationIds;
      if (cids) {
        cids.forEach((cid) => {
          io.to(`conversation:${cid}`).emit("chat:presence", { userId: user.id, online: false });
        });
      }
    });

    socket.on("join:conversation", (conversationId: string) => {
      if (typeof conversationId !== "string") return;
      const roomName = `conversation:${conversationId}`;
      socket.join(roomName);
      (socket.data as { conversationIds?: Set<string> }).conversationIds?.add(conversationId);
      const room = io.sockets.adapter.rooms.get(roomName);
      const onlineUserIds = room
        ? Array.from(room)
            .map((sid) => socketIdToUserId.get(sid))
            .filter((id): id is string => id != null)
          : [];
      socket.emit("presence:state", { onlineUserIds });
      socket.to(roomName).emit("chat:presence", { userId: user.id, online: true });
    });

    socket.on("leave:conversation", (conversationId: string) => {
      if (typeof conversationId !== "string") return;
      (socket.data as { conversationIds?: Set<string> }).conversationIds?.delete(conversationId);
      socket.leave(`conversation:${conversationId}`);
      io.to(`conversation:${conversationId}`).emit("chat:presence", { userId: user.id, online: false });
    });

    socket.on("typing:start", (conversationId: string) => {
      if (typeof conversationId !== "string") return;
      socket.to(`conversation:${conversationId}`).emit("chat:typing", {
        userId: user.id,
        userName,
        active: true
      });
    });

    socket.on("typing:stop", (conversationId: string) => {
      if (typeof conversationId !== "string") return;
      socket.to(`conversation:${conversationId}`).emit("chat:typing", {
        userId: user.id,
        userName,
        active: false
      });
    });

    socket.on("get:presence", () => {
      socket.emit("presence:global", { onlineUserIds: [...new Set(socketIdToUserId.values())] });
    });
  });

  ioInstance = io;
  return io;
}

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error("Socket server is not initialized");
  }
  return ioInstance;
}
