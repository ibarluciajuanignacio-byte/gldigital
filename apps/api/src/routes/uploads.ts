import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { createUploadUrl, createReadUrl, writeLocalObject } from "../services/storage.js";

const uploadRequestSchema = z.object({
  mimeType: z.string().min(1),
  folder: z.string().default("chat")
});

export const uploadsRouter = Router();

uploadsRouter.get("/view", async (req, res) => {
  const objectKey = typeof req.query.objectKey === "string" ? req.query.objectKey : "";
  if (!objectKey) {
    res.status(400).json({ error: "objectKey requerido" });
    return;
  }
  try {
    const url = await createReadUrl(objectKey);
    res.redirect(302, url);
  } catch {
    res.status(404).json({ error: "No encontrado" });
  }
});

uploadsRouter.use(requireAuth);

uploadsRouter.post("/presign", async (req, res) => {
  const input = uploadRequestSchema.parse(req.body);
  const signed = await createUploadUrl({ mimeType: input.mimeType, folder: input.folder });
  res.json(signed);
});

uploadsRouter.put("/local/*path", async (req, res) => {
  const objectKey = String(req.params.path ?? "");
  if (!objectKey) {
    res.status(400).json({ error: "Path requerido" });
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  req.on("end", () => {
    writeLocalObject(objectKey, Buffer.concat(chunks))
      .then(() => {
        res.status(204).send();
      })
      .catch(() => {
        res.status(500).json({ error: "No fue posible guardar el archivo" });
      });
  });
});
