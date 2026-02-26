import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { AuthUser } from "../types/auth.js";
import { env } from "../lib/env.js";
import { verifyToken } from "../lib/auth.js";

let ioInstance: Server | null = null;

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

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(`user:${user.id}`);

    socket.on("join:conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
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
