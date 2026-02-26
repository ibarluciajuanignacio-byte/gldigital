import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  STORAGE_MODE: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.STORAGE_MODE === "s3") {
    if (!value.S3_BUCKET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "S3_BUCKET es requerido en modo s3" });
    }
    if (!value.S3_ACCESS_KEY_ID) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "S3_ACCESS_KEY_ID es requerido en modo s3" });
    }
    if (!value.S3_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "S3_SECRET_ACCESS_KEY es requerido en modo s3"
      });
    }
  }
});

export const env = envSchema.parse(process.env);
