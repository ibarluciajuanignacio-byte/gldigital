/**
 * Crea o actualiza el usuario admin en la base de datos.
 * Útil cuando la BD está en el hosting (MySQL) y querés tener el usuario listo.
 *
 * Uso (en la PC, con la BD del hosting):
 *   1. En apps/api creá o editá .env y poné la URL de MySQL del hosting, ej.:
 *      DATABASE_URL="mysql://usuario:contraseña@mysqlXX.hostinger.com:3306/u412425830_gldigital"
 *   2. Ejecutá: npx tsx scripts/create-admin.ts
 *
 * Después, cuando la API esté en línea, entrá con:
 *   Email: admin@gldigital.local
 *   Contraseña: admin123
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@gldigital.local";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin GLdigital";

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: hash, role: "admin", name: ADMIN_NAME },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "admin",
      passwordHash: hash
    }
  });
  console.log("Listo. Usuario admin creado/actualizado.");
  console.log("  Email:", admin.email);
  console.log("  Contraseña:", ADMIN_PASSWORD);
  console.log("(Cuando la API esté en línea, entrá con esos datos.)");
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
