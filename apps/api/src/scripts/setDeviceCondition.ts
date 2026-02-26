/**
 * Backfill: asigna condition = "sealed" o "used" a dispositivos ya cargados
 * según su warrantyStatus (o location tag).
 *
 * Ejecutar: cd apps/api && npx tsx src/scripts/setDeviceCondition.ts
 */

import { prisma } from "../lib/prisma.js";

async function main() {
  const sealed = await prisma.device.updateMany({
    where: { warrantyStatus: "Activa (sellado)" },
    data: { condition: "sealed" }
  });

  const used = await prisma.device.updateMany({
    where: { warrantyStatus: { not: "Activa (sellado)" } },
    data: { condition: "used" }
  });

  console.log(`condition = sealed: ${sealed.count} equipos`);
  console.log(`condition = used:   ${used.count} equipos`);
  console.log("Backfill completado.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
