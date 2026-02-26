/**
 * Script: borra toda la información de negocio del sistema y carga
 * revendedores, deudas y encargues a partir de la info del block de notas del admin.
 *
 * Ejecutar desde raíz del monorepo o apps/api:
 *   npx tsx apps/api/src/scripts/resetAndSeedFromNotes.ts
 *   cd apps/api && npx tsx src/scripts/resetAndSeedFromNotes.ts
 */

import bcrypt from "bcryptjs";
import { LedgerEntryType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const RESELLER_PASSWORD = "revendedor123";
const RESELLER_EMAIL_SUFFIX = "@gldigital.local";

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const REVENDEDORES: Array<{
  name: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}> = [
  { name: "Mati Adrián" },
  { name: "Elías Moya" },
  { name: "Emma de Azul", city: "Azul", latitude: -36.7769, longitude: -59.8585 },
  { name: "Marcos Touch" },
  { name: "Yane Laprida", city: "Laprida", latitude: -37.5436, longitude: -60.7997 },
  { name: "Joaquín Bolivar", city: "Bolívar", latitude: -36.2262, longitude: -61.1104 },
  { name: "Elías Lamadrid", city: "Lamadrid", latitude: -36.25, longitude: -61.52 },
  { name: "Miguel Pringles", city: "Coronel Pringles", latitude: -38.1409, longitude: -61.3565 },
  { name: "María Hernández" },
  { name: "Fede Marcos Olavarria" },
  { name: "Agustin Rae Pringles" },
  { name: "Joaquin Lopez Lamadrid" },
  { name: "Varios", city: undefined } // señas y encargues sin revendedor asignado
];

const ENCARGUES_VARIOS = [
  { title: "Seña iPhone 16 Pro Black", note: "Clienta (sin nombre)" },
  { title: "Seña iPhone 16 Pro Max", note: "Cliente de Salta" },
  { title: "Encargue iPhone 16 Pro Max", note: "Marce Raineri" }
];

async function main() {
  console.log("Eliminando datos de negocio...");

  await prisma.$transaction(async (tx) => {
    await tx.chatAttachment.deleteMany({});
    await tx.chatMessage.deleteMany({});
    await tx.chatMember.deleteMany({});
    await tx.chatGroup.deleteMany({});
    await tx.chatConversation.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.debtLedgerEntry.deleteMany({});
    await tx.consignmentMovement.deleteMany({});
    await tx.consignment.deleteMany({});
    await tx.stockRequest.deleteMany({});
    await tx.client.deleteMany({});
    await tx.device.deleteMany({});
    await tx.reseller.deleteMany({});
    await tx.user.deleteMany({ where: { role: "reseller" } });
  });

  console.log("Datos eliminados. Creando revendedores...");

  const passwordHash = await bcrypt.hash(RESELLER_PASSWORD, 10);
  const resellerIds: { name: string; id: string }[] = [];

  for (const row of REVENDEDORES) {
    const name = row.name;
    const email = `${slug(name)}${RESELLER_EMAIL_SUFFIX}`;
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: "reseller",
        passwordHash
      }
    });
    const reseller = await prisma.reseller.create({
      data: {
        userId: user.id,
        companyName: name === "Varios" ? "Señas / Encargues" : name,
        city: row.city ?? undefined,
        latitude: row.latitude,
        longitude: row.longitude
      }
    });
    resellerIds.push({ name, id: reseller.id });
  }

  const matiReseller = resellerIds.find((r) => r.name === "Mati Adrián");
  if (matiReseller) {
    await prisma.debtLedgerEntry.create({
      data: {
        resellerId: matiReseller.id,
        entryType: LedgerEntryType.debit,
        amountCents: 500_00, // $500 USD
        currency: "USD",
        reason: "iPhone 15 100% - adeuda"
      }
    });
    console.log("Deuda cargada: Mati Adrián $500 USD");
  }

  const variosReseller = resellerIds.find((r) => r.name === "Varios");
  if (variosReseller) {
    for (const enc of ENCARGUES_VARIOS) {
      await prisma.stockRequest.create({
        data: {
          resellerId: variosReseller.id,
          title: enc.title,
          note: enc.note,
          quantity: 1,
          status: "pending_approval"
        }
      });
    }
    console.log("Encargues/señas cargados: 3 (Varios)");
  }

  console.log("Listo. Revendedores creados:", resellerIds.length);
  console.log("Emails de acceso: <slug>@gldigital.local  Contraseña:", RESELLER_PASSWORD);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
