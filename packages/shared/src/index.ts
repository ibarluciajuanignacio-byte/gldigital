import { z } from "zod";

export const roleSchema = z.enum(["admin", "reseller"]);
export type Role = z.infer<typeof roleSchema>;

export const paymentStatusSchema = z.enum(["reported_pending", "confirmed", "rejected"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const deviceStateSchema = z.string().min(1);
export type DeviceState = string;

export const createPaymentSchema = z.object({
  resellerId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  note: z.string().max(500).optional(),
  receiptAttachmentKey: z.string().optional(),
  cashBoxId: z.string().uuid().optional()
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  attachmentKeys: z.array(z.string()).default([])
});

export const createConversationSchema = z.object({
  type: z.enum(["dm", "group"]),
  name: z.string().optional(),
  memberIds: z.array(z.string().uuid()).min(1)
});
