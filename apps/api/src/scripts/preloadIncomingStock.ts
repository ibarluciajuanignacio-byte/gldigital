import { prisma } from "../lib/prisma.js";

type StockLine = {
  model: string;
  memory: string;
  qty: number;
  colors: string[]; // si hay "mix", poner varios colores
  sealed: boolean;
};

const PRELOAD_TAG = "PRELOAD_INCOMING_2026-02-20";

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

function makeImei(seed: number) {
  // 15 dígitos (no valida Luhn, pero cumple formato y unicidad para preview)
  const base = `35${pad(seed, 13)}`.slice(0, 15);
  return base;
}

function makeSerial(prefix: string, idx: number) {
  return `${prefix}-${pad(idx, 4)}`.toUpperCase();
}

function normalizeModelKey(model: string) {
  return model
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
}

async function main() {
  // NOTA: en tu texto faltaban cantidades en algunas líneas.
  // Acá dejo defaults para "preview". Ajustá los qty y listo.
  const lines: StockLine[] = [
    {
      model: "iPhone 13",
      memory: "128 GB",
      qty: 14,
      colors: ["Negro"],
      sealed: true,
    },
    {
      model: "iPhone 15",
      memory: "128 GB",
      qty: 10, // TODO: confirmar cantidad real
      colors: ["Negro", "Blanco", "Azul", "Rosa", "Verde"],
      sealed: true,
    },
    {
      model: "iPhone 16X",
      memory: "128 GB", // TODO: si cambia, ajustarlo acá
      qty: 8,
      colors: ["Negro", "Blanco", "Azul", "Rosa", "Verde"],
      sealed: true,
    },
    {
      model: "iPhone 16",
      memory: "128 GB",
      qty: 8,
      colors: ["Negro", "Blanco", "Azul", "Rosa", "Verde"],
      sealed: true,
    },
    {
      model: "iPhone 17",
      memory: "256 GB",
      qty: 5, // TODO: confirmar cantidad real
      colors: ["Negro", "Blanco", "Azul", "Rosa", "Verde"],
      sealed: true,
    },
    {
      model: "iPhone 17 Pro",
      memory: "256 GB",
      qty: 5, // TODO: confirmar cantidad real
      colors: ["Negro", "Blanco", "Azul", "Gris"],
      sealed: true,
    },
    {
      model: "iPhone 17 Pro Max",
      memory: "256 GB",
      qty: 5, // TODO: confirmar cantidad real
      colors: ["Negro", "Blanco", "Azul", "Gris"],
      sealed: true,
    },
  ];

  const existing = await prisma.device.count({ where: { location: PRELOAD_TAG } });
  if (existing) {
    await prisma.device.deleteMany({ where: { location: PRELOAD_TAG } });
  }

  const startSeed = Date.now() % 1_000_000_000;
  let created = 0;
  let seed = startSeed;

  for (const line of lines) {
    const modelKey = normalizeModelKey(line.model);
    for (let i = 1; i <= line.qty; i++) {
      const color = line.colors[(i - 1) % Math.max(1, line.colors.length)] ?? "Negro";
      const imei = makeImei(seed++);
      const serialNumber = makeSerial(`${modelKey}`, i);

      await prisma.device.create({
        data: {
          imei,
          serialNumber,
          model: line.model,
          color,
          memory: line.memory,
          warrantyStatus: line.sealed ? "Activa (sellado)" : undefined,
          batteryHealth: line.sealed ? 100 : undefined,
          batteryCycles: line.sealed ? 0 : undefined,
          batteryStatus: line.sealed ? "Nueva" : undefined,
          location: PRELOAD_TAG,
          // state: default available
        },
      });
      created++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`OK: precargados ${created} equipos (tag=${PRELOAD_TAG}).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

