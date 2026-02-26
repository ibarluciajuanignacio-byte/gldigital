import jwt from "jsonwebtoken";
import type { AuthUser } from "../types/auth.js";
import { env } from "./env.js";

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, env.JWT_SECRET) as AuthUser;
}
