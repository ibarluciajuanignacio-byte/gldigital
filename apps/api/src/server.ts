import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { createSocketServer } from "./sockets/index.js";

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // eslint-disable-next-line no-console
    console.log("Base de datos MySQL: conectada.");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("No se pudo conectar a la base de datos.", err);
    // eslint-disable-next-line no-console
    console.error("Revisá que MySQL esté corriendo y DATABASE_URL en apps/api/.env. Luego: cd apps/api && npx prisma db push && npx prisma generate");
    process.exit(1);
  }

  const server = createServer(app);
  createSocketServer(server);

  server.listen(env.PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`API running on http://0.0.0.0:${env.PORT} (red local: http://<tu-IP>:${env.PORT})`);
  });
}

start();
