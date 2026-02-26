/**
 * Carga en inventario el stock que ingresó a oficina (planilla sellados + planilla usados).
 * IMEI/serial generados para unicidad; state = available.
 *
 * Ejecutar: cd apps/api && npx tsx src/scripts/loadOfficeStockFromSheets.ts
 */

import { prisma } from "../lib/prisma.js";

const TAG_SELLADOS = "SELLADOS_INGRESO_OFICINA";
const TAG_USADOS = "USADOS_INGRESO_OFICINA";

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

function makeImei(seed: number): string {
  return `35${pad(seed, 13)}`.slice(0, 15);
}

function makeSerial(prefix: string, idx: number): string {
  return `${prefix}-${pad(idx, 4)}`.toUpperCase();
}

function modelKey(model: string): string {
  return model.replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase();
}

type SelladoLine = { model: string; qty: number; color: string; capacity: string };
type UsadoLine = { model: string; qty: number; color: string; capacity: string; battery?: number };

// —— Planilla SELLADOS (nuevos) ——
const SELLADOS: SelladoLine[] = [
  { model: "iPhone 16", qty: 4, color: "black", capacity: "128 GB" },
  { model: "iPhone 17 Pro", qty: 6, color: "silver", capacity: "256 GB" },
  { model: "iPhone 17 Pro Max", qty: 4, color: "silver", capacity: "256 GB" },
  { model: "iPhone 17 Pro", qty: 2, color: "blue", capacity: "256 GB" },
  { model: "iPhone 18 Pro", qty: 2, color: "orange", capacity: "256 GB" },
  { model: "iPhone 19 Pro", qty: 1, color: "silver", capacity: "256 GB" },
  { model: "iPhone 13", qty: 13, color: "midnight", capacity: "128 GB" },
  { model: "iPhone 15", qty: 3, color: "blue", capacity: "128 GB" },
  { model: "iPhone 15", qty: 2, color: "black", capacity: "128 GB" },
  { model: "iPhone 15", qty: 4, color: "black", capacity: "128 GB" },
  { model: "iPhone 15", qty: 1, color: "blue", capacity: "128 GB" },
  { model: "iPhone 15", qty: 1, color: "teal", capacity: "128 GB" },
  { model: "iPhone 16", qty: 4, color: "pink", capacity: "128 GB" },
];

// —— Planilla USADOS ——
const USADOS: UsadoLine[] = [
  { model: "iPhone 16 Pro Max", qty: 5, color: "black", capacity: "256 GB" },
  { model: "iPhone 16 Pro Max", qty: 6, color: "dessert", capacity: "256 GB" },
  { model: "iPhone 16 Pro Max", qty: 3, color: "natural", capacity: "256 GB" },
  { model: "iPhone 16 Pro Max", qty: 1, color: "white", capacity: "256 GB" },
  { model: "iPhone 15 Pro", qty: 1, color: "blue", capacity: "128 GB" },
  { model: "iPhone 15", qty: 1, color: "black", capacity: "128 GB" },
  { model: "iPhone 17 Pro", qty: 1, color: "like new", capacity: "512 GB" },
  { model: "iPhone 14 Pro", qty: 7, color: "Gold", capacity: "128 GB" },
  { model: "iPhone 14 Pro", qty: 9, color: "Purple", capacity: "128 GB" },
  { model: "iPhone 14 Pro", qty: 15, color: "Black", capacity: "128 GB" },
  { model: "iPhone 14 Pro Max", qty: 3, color: "varios", capacity: "256 GB" },
  { model: "iPhone 17", qty: 1, color: "naranja", capacity: "256 GB" },
];

async function main() {
  const stateAvailable = await prisma.deviceStatus.findFirst({ where: { key: "available" } });
  if (!stateAvailable) {
    throw new Error("No existe estado 'available'. Ejecutá POST /auth/bootstrap antes.");
  }

  let seed = Math.abs((Date.now() % 1_000_000_000)) + 1;
  let created = 0;

  // —— Sellados ——
  for (const line of SELLADOS) {
    const prefix = modelKey(line.model);
    for (let i = 1; i <= line.qty; i++) {
      const imei = makeImei(seed++);
      const serialNumber = makeSerial(prefix, i);
      await prisma.device.create({
        data: {
          imei,
          serialNumber,
          model: line.model,
          color: line.color,
          memory: line.capacity,
          warrantyStatus: "Activa (sellado)",
          batteryHealth: 100,
          batteryCycles: 0,
          batteryStatus: "Nueva",
          state: "available",
          location: TAG_SELLADOS,
        },
      });
      created++;
    }
  }
  console.log(`Sellados: ${SELLADOS.reduce((s, l) => s + l.qty, 0)} equipos creados.`);

  // —— Usados ——
  for (const line of USADOS) {
    const prefix = modelKey(line.model);
    for (let i = 1; i <= line.qty; i++) {
      const imei = makeImei(seed++);
      const serialNumber = makeSerial(prefix, i);
      await prisma.device.create({
        data: {
          imei,
          serialNumber,
          model: line.model,
          color: line.color,
          memory: line.capacity,
          warrantyStatus: "Usado",
          batteryHealth: line.battery ?? undefined,
          batteryStatus: "Usado",
          state: "available",
          location: TAG_USADOS,
        },
      });
      created++;
    }
  }
  console.log(`Usados: ${USADOS.reduce((s, l) => s + l.qty, 0)} equipos creados.`);

  console.log(`Total: ${created} dispositivos cargados (listos para retirar/asignar).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
