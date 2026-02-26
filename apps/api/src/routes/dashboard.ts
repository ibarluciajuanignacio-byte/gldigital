import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getDebtBalanceCents } from "../services/ledger.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

type LiveDollarOfficial = {
  buy: number | null;
  sell: number | null;
  reference: number | null;
  blueBuy: number | null;
  blueSell: number | null;
  blueReference: number | null;
  updatedAgo: string | null;
  source: string;
  sourceLogoUrl: string;
  providerDate: string | null;
  verified: boolean;
  fetchedAt: string;
};

const DOLARHOY_WIDGET_URL = "https://dolarhoy.com/i/cotizaciones/dolar-oficial";
const DOLARHOY_WIDGET_BLUE_URL = "https://dolarhoy.com/i/cotizaciones/dolar-blue";
const DOLARHOY_LOGO_URL = "https://dolarhoy.com/img/estructura/logo_cotizaciones.png";
const DOLAR_API_URL = "https://dolarapi.com/v1/dolares/oficial";
const DOLAR_API_BLUE_URL = "https://dolarapi.com/v1/dolares/blue";
const DOLLAR_CACHE_TTL_MS = 60_000;
let dollarCache: { data: LiveDollarOfficial; expiresAt: number } | null = null;

function parseArNumber(raw: string): number {
  return Number(raw.replace(/\./g, "").replace(",", "."));
}

function extractWidgetValues(html: string): { buy: number | null; sell: number | null; reference: number | null; updatedAgo: string | null } {
  const valuesBlockMatch = html.match(/<div class="data__valores">([\s\S]*?)<\/div>/i);
  const valuesBlock = valuesBlockMatch?.[1] ?? "";

  const valueMatches = Array.from(valuesBlock.matchAll(/<p>\s*([0-9.,]+)\s*<span>\s*([^<]+)\s*<\/span>\s*<\/p>/gi));
  const map = new Map<string, number>();
  for (const match of valueMatches) {
    const rawValue = match[1];
    const rawLabel = match[2]?.trim().toLowerCase();
    if (rawValue && rawLabel) {
      map.set(rawLabel, parseArNumber(rawValue));
    }
  }

  const updatedMatch = html.match(/fecha-container__valor">Actualizado hace\s*([^<]+)</i);

  return {
    buy: map.get("compra") ?? null,
    sell: map.get("venta") ?? null,
    reference: map.get("valor") ?? null,
    updatedAgo: updatedMatch?.[1]?.trim() ?? null
  };
}

async function fetchDollarApiOfficial(): Promise<{ buy: number | null; sell: number | null; providerDate: string | null }> {
  const response = await fetch(DOLAR_API_URL, {
    headers: { "user-agent": "GLdigital/1.0 (+dashboard-dollar-live)" }
  });
  if (!response.ok) {
    throw new Error(`No se pudo validar cotización con proveedor secundario (${response.status})`);
  }
  const data = (await response.json()) as {
    compra?: unknown;
    venta?: unknown;
    fechaActualizacion?: unknown;
  };
  return {
    buy: typeof data.compra === "number" ? data.compra : null,
    sell: typeof data.venta === "number" ? data.venta : null,
    providerDate: typeof data.fechaActualizacion === "string" ? data.fechaActualizacion : null
  };
}

async function fetchDollarApiBlue(): Promise<{ buy: number | null; sell: number | null; providerDate: string | null }> {
  const response = await fetch(DOLAR_API_BLUE_URL, {
    headers: { "user-agent": "GLdigital/1.0 (+dashboard-dollar-live)" }
  });
  if (!response.ok) {
    throw new Error(`No se pudo validar cotización con proveedor secundario (${response.status})`);
  }
  const data = (await response.json()) as {
    compra?: unknown;
    venta?: unknown;
    fechaActualizacion?: unknown;
  };
  return {
    buy: typeof data.compra === "number" ? data.compra : null,
    sell: typeof data.venta === "number" ? data.venta : null,
    providerDate: typeof data.fechaActualizacion === "string" ? data.fechaActualizacion : null
  };
}

function samePrice(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.01;
}

async function fetchLiveDollarOfficial(): Promise<LiveDollarOfficial> {
  const now = Date.now();
  if (dollarCache && dollarCache.expiresAt > now) {
    return dollarCache.data;
  }

  const response = await fetch(DOLARHOY_WIDGET_URL, {
    headers: { "user-agent": "GLdigital/1.0 (+dashboard-dollar-live)" }
  });
  if (!response.ok) {
    throw new Error(`No se pudo obtener cotización en vivo (${response.status})`);
  }

  const [htmlOfficial, responseBlue, providerOfficial, providerBlue] = await Promise.all([
    response.text(),
    fetch(DOLARHOY_WIDGET_BLUE_URL, {
      headers: { "user-agent": "GLdigital/1.0 (+dashboard-dollar-live)" }
    }),
    fetchDollarApiOfficial(),
    fetchDollarApiBlue()
  ]);
  if (!responseBlue.ok) {
    throw new Error(`No se pudo obtener cotización blue en vivo (${responseBlue.status})`);
  }

  const htmlBlue = await responseBlue.text();
  const widgetOfficial = extractWidgetValues(htmlOfficial);
  const widgetBlue = extractWidgetValues(htmlBlue);

  if (!samePrice(widgetOfficial.buy, providerOfficial.buy) || !samePrice(widgetOfficial.sell, providerOfficial.sell)) {
    throw new Error("Las fuentes no coinciden en dólar oficial (compra/venta). Se bloquea publicación.");
  }
  if (!samePrice(widgetBlue.buy, providerBlue.buy) || !samePrice(widgetBlue.sell, providerBlue.sell)) {
    throw new Error("Las fuentes no coinciden en dólar blue (compra/venta). Se bloquea publicación.");
  }

  const data: LiveDollarOfficial = {
    buy: widgetOfficial.buy,
    sell: widgetOfficial.sell,
    reference: widgetOfficial.reference,
    blueBuy: widgetBlue.buy,
    blueSell: widgetBlue.sell,
    blueReference: widgetBlue.reference,
    updatedAgo: widgetOfficial.updatedAgo ?? widgetBlue.updatedAgo,
    source: "DolarHoy",
    sourceLogoUrl: DOLARHOY_LOGO_URL,
    providerDate: providerOfficial.providerDate ?? providerBlue.providerDate,
    verified: true,
    fetchedAt: new Date().toISOString()
  };

  dollarCache = { data, expiresAt: now + DOLLAR_CACHE_TTL_MS };
  return data;
}

dashboardRouter.get("/", async (req, res) => {
  if (req.user!.role === "admin") {
    const [
      devices,
      consignments,
      paymentsPending,
      resellersCount,
      devicesByStateRows,
      consignmentsByStatusRows,
      paymentsByStatusRows,
      resellersWithUser,
      activeStatuses,
      resellerBirthdays,
      clientBirthdays
    ] = await Promise.all([
      prisma.device.count(),
      prisma.consignment.count({ where: { status: "active" } }),
      prisma.payment.count({ where: { status: "reported_pending" } }),
      prisma.reseller.count(),
      prisma.device.groupBy({ by: ["state"], _count: { id: true } }),
      prisma.consignment.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.payment.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.reseller.findMany({ select: { id: true, user: { select: { name: true } } } }),
      prisma.deviceStatus.findMany({ where: { isActive: true }, select: { key: true } }),
      prisma.reseller.findMany({ where: { birthday: { not: null } }, select: { birthday: true } }),
      prisma.client.findMany({ where: { birthday: { not: null } }, select: { birthday: true } })
    ]);

    const balances = await Promise.all(
      resellersWithUser.map((r) => getDebtBalanceCents(r.id).then((c) => ({ resellerName: r.user.name, balanceCents: c })))
    );
    const totalDebtCents = balances.reduce((acc, n) => acc + n.balanceCents, 0);

    const devicesByState: Record<string, number> = Object.fromEntries(activeStatuses.map((s) => [s.key, 0]));
    for (const row of devicesByStateRows) {
      devicesByState[row.state] = row._count.id;
    }
    const consignmentsByStatus: Record<string, number> = { active: 0, sold: 0 };
    for (const row of consignmentsByStatusRows) {
      consignmentsByStatus[row.status] = row._count.id;
    }
    const paymentsByStatus: Record<string, number> = { reported_pending: 0, confirmed: 0, rejected: 0 };
    for (const row of paymentsByStatusRows) {
      paymentsByStatus[row.status] = row._count.id;
    }
    const debtByReseller = balances
      .filter((b) => b.balanceCents !== 0)
      .sort((a, b) => b.balanceCents - a.balanceCents)
      .slice(0, 10);

    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();
    const daysUntil = (birthday: Date | null) => {
      if (!birthday) return 999;
      const t = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      if (t < today) t.setFullYear(t.getFullYear() + 1);
      return Math.floor((t.getTime() - new Date(today.getFullYear(), month, day).getTime()) / 86_400_000);
    };
    const upcomingBirthdays = [...resellerBirthdays, ...clientBirthdays].filter((i) => daysUntil(i.birthday) <= 14).length;

    res.json({
      kpis: { devices, consignments, paymentsPending, totalDebtCents, resellers: resellersCount, upcomingBirthdays },
      charts: {
        devicesByState,
        consignmentsByStatus,
        paymentsByStatus,
        debtByReseller
      }
    });
    return;
  }

  const [visibleStatuses] = await Promise.all([
    prisma.deviceStatus.findMany({
      where: { isActive: true, isVisibleForReseller: true },
      select: { key: true }
    })
  ]);
  const visibleKeys = visibleStatuses.map((s) => s.key);

  const [devices, paymentsPending, devicesByStateRows, paymentsByStatusRows] = await Promise.all([
    prisma.device.count({
      where: {
        state: { in: visibleKeys },
        OR: [{ resellerId: req.user!.resellerId }, { state: "available" }]
      }
    }),
    prisma.payment.count({
      where: { resellerId: req.user!.resellerId, status: "reported_pending" }
    }),
    prisma.device.groupBy({
      by: ["state"],
      where: {
        state: { in: visibleKeys },
        OR: [{ resellerId: req.user!.resellerId }, { state: "available" }]
      },
      _count: { id: true }
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where: { resellerId: req.user!.resellerId },
      _count: { id: true }
    })
  ]);
  const debtCents = await getDebtBalanceCents(req.user!.resellerId!);

  const devicesByState: Record<string, number> = Object.fromEntries(visibleStatuses.map((s) => [s.key, 0]));
  for (const row of devicesByStateRows) {
    devicesByState[row.state] = row._count.id;
  }
  const paymentsByStatus: Record<string, number> = { reported_pending: 0, confirmed: 0, rejected: 0 };
  for (const row of paymentsByStatusRows) {
    paymentsByStatus[row.status] = row._count.id;
  }

  res.json({
    kpis: { devices, paymentsPending, debtCents },
    charts: { devicesByState, paymentsByStatus }
  });
});

dashboardRouter.get("/dollar-live", async (_req, res) => {
  try {
    const data = await fetchLiveDollarOfficial();
    res.json(data);
  } catch (error) {
    if (dollarCache?.data) {
      res.json({ ...dollarCache.data, stale: true });
      return;
    }
    res.status(502).json({
      message: "No se pudo obtener la cotización en vivo en este momento."
    });
  }
});
