import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import cors from "cors";
import morgan from "morgan";
import { Prisma } from "@prisma/client";
import { env } from "./lib/env.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { devicesRouter } from "./routes/devices.js";
import { consignmentsRouter } from "./routes/consignments.js";
import { debtsRouter } from "./routes/debts.js";
import { paymentsRouter } from "./routes/payments.js";
import { chatRouter } from "./routes/chat.js";
import { uploadsRouter } from "./routes/uploads.js";
import { resellersRouter } from "./routes/resellers.js";
import { notificationsRouter } from "./routes/notifications.js";
import { deviceStatusesRouter } from "./routes/device-statuses.js";
import { stockRouter } from "./routes/stock.js";
import { clientsRouter } from "./routes/clients.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { purchasesRouter } from "./routes/purchases.js";
import { techniciansRouter } from "./routes/technicians.js";
import { repairRecordsRouter } from "./routes/repair-records.js";
import { catalogRouter } from "./routes/catalog.js";
import { cashboxesRouter } from "./routes/cashboxes.js";
import { getLocalStorageRoot } from "./services/storage.js";

export const app = express();

app.use(
  cors({
    // Fuera de producción acepta cualquier origen (para probar desde celular en red local)
    origin: process.env.NODE_ENV === "production" ? env.CORS_ORIGIN : true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
if (env.STORAGE_MODE === "local") {
  app.use("/uploads/local", express.static(path.resolve(getLocalStorageRoot())));
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/devices", devicesRouter);
app.use("/consignments", consignmentsRouter);
app.use("/debts", debtsRouter);
app.use("/payments", paymentsRouter);
app.use("/chat", chatRouter);
app.use("/uploads", uploadsRouter);
app.use("/resellers", resellersRouter);
app.use("/notifications", notificationsRouter);
app.use("/device-statuses", deviceStatusesRouter);
app.use("/stock", stockRouter);
app.use("/clients", clientsRouter);
app.use("/suppliers", suppliersRouter);
app.use("/purchases", purchasesRouter);
app.use("/technicians", techniciansRouter);
app.use("/repair-records", repairRecordsRouter);
app.use("/catalog", catalogRouter);
app.use("/cashboxes", cashboxesRouter);

// En producción: servir el frontend (mismo origen = una sola URL para todo)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

// Ruta no encontrada
app.use((_req, res) => {
  res.status(404).json({ message: "Ruta no encontrada." });
});

// Manejo global de errores (incl. rechazos de promesas en rutas async con Express 5)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isPrismaKnown = err instanceof Prisma.PrismaClientKnownRequestError;
  const isPrismaInit = err instanceof Prisma.PrismaClientInitializationError;
  const code = isPrismaKnown ? (err as Prisma.PrismaClientKnownRequestError).code : null;
  let status = code === "P2025" ? 404 : code === "P2002" ? 409 : 500;
  let message: string;

  if (isPrismaInit) {
    status = 503;
    message =
      "No se pudo conectar a la base de datos. Revisá que MySQL esté corriendo y que DATABASE_URL en la API sea correcto.";
  } else if (code === "P2025") {
    message = "Registro no encontrado.";
  } else if (code === "P2002") {
    message = "Ya existe un registro con ese valor (ej. IMEI duplicado).";
  } else if (code === "P2021") {
    status = 503;
    message =
      "La tabla no existe en la base de datos. Ejecutá las migraciones: cd apps/api && npx prisma migrate deploy";
  } else if (code === "P1001" || code === "P1002" || code === "P1017") {
    status = 503;
    message =
      "No se puede conectar a la base de datos. Revisá que MySQL esté activo y que DATABASE_URL sea correcto.";
  } else if (process.env.NODE_ENV === "production") {
    message = "Error del servidor.";
  } else {
    message = err instanceof Error ? err.message : "Error del servidor.";
  }

  if (status >= 500) {
    console.error("[API] Error no controlado:", err);
  }
  res.status(status).json({ message });
});
