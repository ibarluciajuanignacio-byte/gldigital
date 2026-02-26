/**
 * Script: asigna ciudad y coordenadas a revendedores existentes por nombre.
 * No borra datos; solo actualiza los que coinciden con la lista.
 *
 * Ejecutar desde raíz del monorepo o apps/api:
 *   npx tsx apps/api/src/scripts/updateResellerLocations.ts
 */

import { prisma } from "../lib/prisma.js";

const LOCATIONS: Array<{ userName: string; city: string; latitude: number; longitude: number }> = [
  { userName: "Emma de Azul", city: "Azul", latitude: -36.7769, longitude: -59.8585 },
  { userName: "Yane Laprida", city: "Laprida", latitude: -37.5436, longitude: -60.7997 },
  { userName: "Joaquín Bolivar", city: "Bolívar", latitude: -36.2262, longitude: -61.1104 },
  { userName: "Elías Lamadrid", city: "Lamadrid", latitude: -36.25, longitude: -61.52 },
  { userName: "Miguel Pringles", city: "Coronel Pringles", latitude: -38.1409, longitude: -61.3565 }
];

async function main() {
  for (const loc of LOCATIONS) {
    const user = await prisma.user.findFirst({
      where: { name: loc.userName, role: "reseller" },
      include: { reseller: true }
    });
    if (!user?.reseller) {
      console.log("No encontrado:", loc.userName);
      continue;
    }
    await prisma.reseller.update({
      where: { id: user.reseller.id },
      data: {
        city: loc.city,
        latitude: loc.latitude,
        longitude: loc.longitude
      }
    });
    console.log("OK:", loc.userName, "->", loc.city);
  }
  console.log("Listo.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
