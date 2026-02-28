/**
 * Inserta los estados de equipo (DeviceStatus) mínimos que la app necesita.
 * Si borraste todos los datos, ejecutá esto después de crear el admin:
 *
 *   cd apps/api && npx tsx scripts/seed-device-statuses.ts
 *
 * Luego podés crear equipos, revendedores, etc. desde cero.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATUSES = [
  { key: "available", name: "Disponible", sector: "office" as const, isSellable: true, isVisibleForReseller: true, sortOrder: 10 },
  { key: "sold", name: "Vendido", sector: "office" as const, isSellable: false, isVisibleForReseller: true, sortOrder: 20 },
  { key: "pending_receive", name: "Pend. recepción", sector: "office" as const, isSellable: false, isVisibleForReseller: false, sortOrder: 30 },
  { key: "pending_scan", name: "Pend. escanear", sector: "office" as const, isSellable: false, isVisibleForReseller: false, sortOrder: 40 },
  { key: "in_technician", name: "En técnico", sector: "office" as const, isSellable: false, isVisibleForReseller: false, sortOrder: 50 }
];

async function main() {
  for (const s of STATUSES) {
    await prisma.deviceStatus.upsert({
      where: { key: s.key },
      update: { name: s.name, sector: s.sector, isSellable: s.isSellable, isVisibleForReseller: s.isVisibleForReseller, sortOrder: s.sortOrder, isActive: true },
      create: s
    });
  }
  console.log("Listo. Estados de equipo restaurados:", STATUSES.map((s) => s.key).join(", "));
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
