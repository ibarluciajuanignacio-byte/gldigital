import { Router } from "express";
import bcrypt from "bcryptjs";
import { LedgerEntryType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  parseNotesRaw,
  normalizeNameForMatch,
  nameMatches,
  type ParsedBlock
} from "../services/notesParser.js";
import { writeAuditLog } from "../services/audit.js";

export const notesRouter = Router();
notesRouter.use(requireAuth);

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

function findBestResellerMatch(
  parsedName: string,
  resellers: Array<{ id: string; user: { name: string } }>
): { id: string; name: string } | null {
  const parsedNorm = normalizeNameForMatch(parsedName);
  const candidates = resellers.filter((r) => nameMatches(parsedNorm, normalizeNameForMatch(r.user.name)));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].user.name };
  const existingNorms = candidates.map((r) => ({ id: r.id, name: r.user.name, norm: normalizeNameForMatch(r.user.name) }));
  const byCommonWords = existingNorms
    .map((e) => {
      const pTokens = parsedNorm.split(/\s+/).filter(Boolean);
      const eTokens = e.norm.split(/\s+/).filter(Boolean);
      const common = pTokens.filter((t) => eTokens.includes(t));
      return { ...e, score: common.length, len: e.norm.length };
    })
    .sort((a, b) => b.score - a.score || a.len - b.len);
  return { id: byCommonWords[0].id, name: byCommonWords[0].name };
}

function findBestClientMatch(
  parsedName: string,
  clients: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const parsedNorm = normalizeNameForMatch(parsedName);
  const candidates = clients.filter((c) => nameMatches(parsedNorm, normalizeNameForMatch(c.name)));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].name };
  const withScore = candidates.map((c) => {
    const cNorm = normalizeNameForMatch(c.name);
    const pTokens = parsedNorm.split(/\s+/).filter(Boolean);
    const eTokens = cNorm.split(/\s+/).filter(Boolean);
    const common = pTokens.filter((t) => eTokens.includes(t));
    return { id: c.id, name: c.name, score: common.length, len: cNorm.length };
  });
  withScore.sort((a, b) => b.score - a.score || a.len - b.len);
  return { id: withScore[0].id, name: withScore[0].name };
}

/** Get or create "Varios" reseller for loose requests */
async function getOrCreateVariosReseller(): Promise<{ id: string; name: string }> {
  const userVarios = await prisma.user.findFirst({
    where: { role: "reseller", name: "Varios" }
  });
  if (userVarios) {
    const r = await prisma.reseller.findUnique({ where: { userId: userVarios.id } });
    if (r) return { id: r.id, name: userVarios.name };
  }
  const byCompany = await prisma.reseller.findMany({
    where: { companyName: { contains: "Varios" } },
    include: { user: true }
  });
  if (byCompany[0]) return { id: byCompany[0].id, name: byCompany[0].user.name };
  const bySeñas = await prisma.reseller.findMany({
    where: { companyName: { contains: "Señas" } },
    include: { user: true }
  });
  if (bySeñas[0]) return { id: bySeñas[0].id, name: bySeñas[0].user.name };

  const passwordHash = await bcrypt.hash(RESELLER_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: `varios-${Date.now()}${RESELLER_EMAIL_SUFFIX}`,
      name: "Varios",
      role: "reseller",
      passwordHash
    }
  });
  const reseller = await prisma.reseller.create({
    data: {
      userId: user.id,
      companyName: "Señas / Encargues"
    }
  });
  return { id: reseller.id, name: user.name };
}

/** Preview item for parse response */
export type NoteParsePreview = {
  createResellers: Array<{ name: string }>;
  createClients: Array<{ name: string; resellerName?: string }>;
  debtEntries: Array<{ resellerName: string; reason: string; amountCents: number | null; currency: string }>;
  stockRequests: Array<{ resellerName: string; title: string; quantity: number; note?: string | null }>;
  matchedResellers: Array<{ parsedName: string; matchedName: string }>;
  matchedClients: Array<{ parsedName: string; matchedName: string }>;
};

type NotesImportMeta = {
  title: string;
  rawText: string;
  created: { resellers: number; clients: number; debts: number; requests: number };
  /** IDs creados en esta importación, para poder revertir */
  createdResellerIds?: Array<{ resellerId: string; userId: string }>;
  createdClientIds?: string[];
  createdDebtEntryIds?: string[];
  createdStockRequestIds?: string[];
};

notesRouter.get("/imports", requireRole("admin"), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { action: "notes.import.applied", entityType: "note_import" },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const imports = logs.map((l) => {
    const meta = (l.meta ?? null) as NotesImportMeta | null;
    return {
      id: l.entityId,
      createdAt: l.createdAt.toISOString(),
      title: meta?.title ?? "Nota importada",
      created: meta?.created ?? { resellers: 0, clients: 0, debts: 0, requests: 0 }
    };
  });
  res.json({ imports });
});

notesRouter.get("/imports/:id", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  const log = await prisma.auditLog.findFirst({
    where: { action: "notes.import.applied", entityType: "note_import", entityId: id },
    orderBy: { createdAt: "desc" }
  });
  if (!log) {
    res.status(404).json({ message: "Nota no encontrada." });
    return;
  }
  const meta = (log.meta ?? null) as NotesImportMeta | null;
  res.json({
    id: log.entityId,
    createdAt: log.createdAt.toISOString(),
    title: meta?.title ?? "Nota importada",
    rawText: meta?.rawText ?? "",
    created: meta?.created ?? { resellers: 0, clients: 0, debts: 0, requests: 0 }
  });
});

/** Lista revendedores y clientes creados recientemente (para limpiar una carga hecha antes de tener "Notas") */
notesRouter.get("/cleanup-candidates", requireRole("admin"), async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // últimas 24h
  const resellers = await prisma.reseller.findMany({
    where: { createdAt: { gte: since } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });
  const varios = await prisma.user.findFirst({
    where: { role: "reseller", name: "Varios" }
  });
  const variosResellerId = varios
    ? (await prisma.reseller.findUnique({ where: { userId: varios.id } }))?.id ?? null
    : null;
  const normalizedVarios = "varios";
  const resellersFiltered = resellers.filter((r) => {
    const norm = normalizeNameForMatch(r.user.name);
    if (norm === normalizedVarios || (r.companyName ?? "").toLowerCase().includes("varios") || (r.companyName ?? "").toLowerCase().includes("señas")) return false;
    return true;
  });
  const clients = variosResellerId
    ? await prisma.client.findMany({
        where: { resellerId: variosResellerId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" }
      })
    : [];
  res.json({
    resellers: resellersFiltered.map((r) => ({ id: r.id, name: r.user.name, createdAt: r.createdAt.toISOString() })),
    clients: clients.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt.toISOString() }))
  });
});

/** Borra revendedores y/o clientes por ID (sus tareas y deudas se eliminan en cascada). Para limpiar cargas viejas sin registro en Notas. */
notesRouter.post("/cleanup", requireRole("admin"), async (req, res) => {
  const resellerIds = Array.isArray(req.body?.resellerIds) ? req.body.resellerIds.filter((id) => typeof id === "string") as string[] : [];
  const clientIds = Array.isArray(req.body?.clientIds) ? req.body.clientIds.filter((id) => typeof id === "string") as string[] : [];
  if (resellerIds.length === 0 && clientIds.length === 0) {
    res.status(400).json({ message: "Indicá al menos un revendedor o cliente a borrar (resellerIds o clientIds)." });
    return;
  }
  const variosUser = await prisma.user.findFirst({ where: { role: "reseller", name: "Varios" } });
  const variosReseller = variosUser ? await prisma.reseller.findUnique({ where: { userId: variosUser.id } }) : null;
  const variosId = variosReseller?.id ?? null;
  if (resellerIds.length > 0 && variosId && resellerIds.includes(variosId)) {
    res.status(400).json({ message: "No se puede borrar el revendedor Varios." });
    return;
  }
  const toDeleteResellers = await prisma.reseller.findMany({
    where: { id: { in: resellerIds } },
    include: { user: true }
  });
  await prisma.$transaction(async (tx) => {
    for (const reseller of toDeleteResellers) {
      const consignmentIds = (await tx.consignment.findMany({ where: { resellerId: reseller.id }, select: { id: true } })).map((c) => c.id);
      if (consignmentIds.length > 0) {
        await tx.consignmentMovement.deleteMany({ where: { consignmentId: { in: consignmentIds } } });
        await tx.consignment.deleteMany({ where: { id: { in: consignmentIds } } });
      }
      await tx.stockRequest.deleteMany({ where: { resellerId: reseller.id } });
      await tx.debtLedgerEntry.deleteMany({ where: { resellerId: reseller.id } });
      await tx.payment.deleteMany({ where: { resellerId: reseller.id } });
      await tx.client.deleteMany({ where: { resellerId: reseller.id } });
      await tx.device.updateMany({ where: { resellerId: reseller.id }, data: { resellerId: null } });
      await tx.reseller.deleteMany({ where: { id: reseller.id } });
      const uid = reseller.userId;
      await tx.notification.deleteMany({ where: { userId: uid } });
      await tx.chatMember.deleteMany({ where: { userId: uid } });
      await tx.chatMessage.updateMany({ where: { senderId: uid }, data: { senderId: null } });
      await tx.auditLog.updateMany({ where: { actorId: uid }, data: { actorId: null } });
      await tx.user.deleteMany({ where: { id: uid } });
    }
    if (clientIds.length > 0) {
      const where = variosId ? { id: { in: clientIds }, resellerId: variosId } : { id: { in: clientIds } };
      await tx.client.deleteMany({ where });
    }
  });
  res.json({
    ok: true,
    deleted: { resellers: toDeleteResellers.length, clients: clientIds.length },
    message: `Se borraron ${toDeleteResellers.length} revendedores (y sus tareas/deudas) y ${clientIds.length} clientes.`
  });
});

notesRouter.post("/imports/:id/revert", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  const log = await prisma.auditLog.findFirst({
    where: { action: "notes.import.applied", entityType: "note_import", entityId: id },
    orderBy: { createdAt: "desc" }
  });
  if (!log) {
    res.status(404).json({ message: "Importación no encontrada." });
    return;
  }
  const meta = (log.meta ?? null) as NotesImportMeta | null;
  const debtIds = meta?.createdDebtEntryIds ?? [];
  const requestIds = meta?.createdStockRequestIds ?? [];
  const clientIds = meta?.createdClientIds ?? [];
  const resellerPairs = meta?.createdResellerIds ?? [];

  if (
    debtIds.length === 0 &&
    requestIds.length === 0 &&
    clientIds.length === 0 &&
    resellerPairs.length === 0
  ) {
    res.status(400).json({
      message:
        "Esta importación no tiene registros para revertir (fue creada antes de que existiera la función deshacer)."
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (requestIds.length > 0) {
      await tx.stockRequest.deleteMany({ where: { id: { in: requestIds } } });
    }
    if (debtIds.length > 0) {
      await tx.debtLedgerEntry.deleteMany({ where: { id: { in: debtIds } } });
    }
    if (clientIds.length > 0) {
      await tx.client.deleteMany({ where: { id: { in: clientIds } } });
    }
    for (const { resellerId, userId } of resellerPairs) {
      await tx.reseller.deleteMany({ where: { id: resellerId } });
      await tx.user.deleteMany({ where: { id: userId } });
    }
  });

  res.json({
    ok: true,
    message: "Carga revertida: se eliminaron las deudas, encargues, clientes y revendedores creados en esta importación."
  });
});

notesRouter.post("/parse", requireRole("admin"), async (req, res) => {
  try {
    const rawText = typeof req.body?.rawText === "string" ? req.body.rawText : "";
    if (!rawText.trim()) {
      res.status(400).json({ message: "rawText es requerido." });
      return;
    }

    const blocks = parseNotesRaw(rawText);
    if (blocks.length === 0) {
      res.status(400).json({
        message:
          "No se detectaron personas ni tareas en el texto. Escribí el nombre de la persona en una línea y debajo sus tareas o deudas."
      });
      return;
    }
    const resellers = await prisma.reseller.findMany({
      include: { user: { select: { name: true } } }
    });
    const clients = await prisma.client.findMany({
      select: { id: true, name: true }
    });

    const createResellers: Array<{ name: string }> = [];
    const createClients: Array<{ name: string; resellerName?: string }> = [];
    const debtEntries: NoteParsePreview["debtEntries"] = [];
    const stockRequests: NoteParsePreview["stockRequests"] = [];
    const matchedResellers: NoteParsePreview["matchedResellers"] = [];
    const matchedClients: NoteParsePreview["matchedClients"] = [];

    // En /parse no escribimos en DB: si no existe "Varios", igual devolvemos preview usando el label "Varios".
    const existingVarios =
      resellers.find((r) => normalizeNameForMatch(r.user.name) === "varios") ??
      resellers.find((r) => (r.companyName ?? "").toLowerCase().includes("señas")) ??
      null;
    const variosLabel = "Varios";
    const resellersWithVarios = existingVarios
      ? resellers
      : [...resellers, { id: "__varios__", user: { name: variosLabel } } as any];

    for (const block of blocks) {
      const isVarios = block.personName === "Varios";
      let resellerId: string | null = null;
      let resellerDisplayName: string = block.personName;
      let clientId: string | null = null;

      if (block.personType === "reseller" || isVarios) {
        const match = findBestResellerMatch(block.personName, resellersWithVarios);
        if (match) {
          resellerId = match.id;
          resellerDisplayName = match.name;
          if (match.name !== block.personName && !isVarios) {
            matchedResellers.push({ parsedName: block.personName, matchedName: match.name });
          }
        } else if (!isVarios) {
          createResellers.push({ name: block.personName });
          resellerDisplayName = block.personName;
        }
      } else {
        const match = findBestClientMatch(block.personName, clients);
        if (match) {
          clientId = match.id;
          if (match.name !== block.personName) {
            matchedClients.push({ parsedName: block.personName, matchedName: match.name });
          }
        } else {
          createClients.push({ name: block.personName, resellerName: "Varios" });
        }
      }

      for (const d of block.debts) {
        const assignName = block.personType === "reseller" || isVarios ? resellerDisplayName : variosLabel;
        debtEntries.push({
          resellerName: assignName,
          reason: d.reason,
          amountCents: d.amountCents,
          currency: d.currency
        });
      }

      const requestResellerName =
        block.personType === "reseller" || isVarios ? resellerDisplayName : variosLabel;
      for (const r of block.requests) {
        const note =
          block.personType === "client" && clientId
            ? `${block.personName}: ${r.note || r.title}`
            : r.note;
        stockRequests.push({
          resellerName: requestResellerName,
          title: r.title,
          quantity: r.quantity,
          note: note ?? undefined
        });
      }
    }

    res.json({
      preview: {
        createResellers,
        createClients,
        debtEntries,
        stockRequests,
        matchedResellers,
        matchedClients
      },
      normalizedBlocks: blocks.map((b) => ({
        personName: b.personName,
        personType: b.personType,
        debtCount: b.debts.length,
        requestCount: b.requests.length
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notes/parse]", err);
    res.status(400).json({ message: "No se pudo interpretar la nota. " + message });
  }
});

notesRouter.post("/apply", requireRole("admin"), async (req, res) => {
  const rawText = typeof req.body?.rawText === "string" ? req.body.rawText : "";
  if (!rawText.trim()) {
    res.status(400).json({ message: "rawText es requerido." });
    return;
  }

  const actorId = req.user!.id;
  const blocks = parseNotesRaw(rawText);
  const resellers = await prisma.reseller.findMany({
    include: { user: true }
  });
  const clients = await prisma.client.findMany();

  const varios = await getOrCreateVariosReseller();
  const resellersWithVarios = [...resellers, { id: varios.id, user: { name: varios.name } }];
  const resellerMap = new Map<string, string>();
  const clientMap = new Map<string, string>();
  const createdResellerIds: Array<{ resellerId: string; userId: string }> = [];
  const createdClientIds: string[] = [];
  const createdDebtEntryIds: string[] = [];
  const createdStockRequestIds: string[] = [];

  const created: { resellers: number; clients: number; debts: number; requests: number } = {
    resellers: 0,
    clients: 0,
    debts: 0,
    requests: 0
  };

  async function ensureReseller(name: string): Promise<string> {
    if (name === "Varios") return varios.id;
    const existing = findBestResellerMatch(name, resellersWithVarios);
    if (existing) {
      resellerMap.set(name, existing.id);
      return existing.id;
    }
    const cached = resellerMap.get(name);
    if (cached) return cached;
    const email = `${slug(name)}${RESELLER_EMAIL_SUFFIX}`;
    const existingUser = await prisma.user.findFirst({
      where: { email, role: "reseller" }
    });
    if (existingUser) {
      const r = await prisma.reseller.findUnique({ where: { userId: existingUser.id } });
      if (r) {
        resellerMap.set(name, r.id);
        return r.id;
      }
    }
    const passwordHash = await bcrypt.hash(RESELLER_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { name, email, role: "reseller", passwordHash }
    });
    const reseller = await prisma.reseller.create({
      data: { userId: user.id, companyName: name }
    });
    resellerMap.set(name, reseller.id);
    created.resellers++;
    createdResellerIds.push({ resellerId: reseller.id, userId: user.id });
    await writeAuditLog({
      actorId,
      action: "reseller.created",
      entityType: "reseller",
      entityId: reseller.id,
      meta: { source: "notes_import" }
    });
    return reseller.id;
  }

  async function ensureClient(name: string, resellerId: string): Promise<string> {
    const existing = findBestClientMatch(name, clients);
    if (existing) return existing.id;
    const cached = clientMap.get(name);
    if (cached) return cached;
    const client = await prisma.client.create({
      data: { name, resellerId }
    });
    clientMap.set(name, client.id);
    created.clients++;
    createdClientIds.push(client.id);
    return client.id;
  }

  type BlockWithResellerId = ParsedBlock & { resellerId: string };
  const resolvedBlocks: BlockWithResellerId[] = [];

  for (const block of blocks) {
    const isVarios = block.personName === "Varios";
    let resellerId: string | null = null;

    if (block.personType === "reseller" || isVarios) {
      resellerId = await ensureReseller(block.personName);
    } else {
      const variosId = await getOrCreateVariosReseller();
      await ensureClient(block.personName, variosId.id);
      resellerId = variosId.id;
    }

    if (resellerId) resolvedBlocks.push({ ...block, resellerId });
  }

  await prisma.$transaction(async (tx) => {
    for (const block of resolvedBlocks) {
      for (const d of block.debts) {
        const assignResellerId =
          block.personType === "client" ? (await getOrCreateVariosReseller()).id : block.resellerId;
        const amountCents = d.currency === "USD" && d.amountCents != null ? d.amountCents : 0;
        if (d.currency === "ARS" && d.amountCents != null) {
          const entry = await tx.debtLedgerEntry.create({
            data: {
              resellerId: assignResellerId,
              entryType: LedgerEntryType.debit,
              amountCents: d.amountCents,
              currency: "ARS",
              reason: d.reason,
              referenceType: "notes_import"
            }
          });
          createdDebtEntryIds.push(entry.id);
        } else if (amountCents > 0 || (d.amountCents === null && d.reason.trim())) {
          const entry = await tx.debtLedgerEntry.create({
            data: {
              resellerId: assignResellerId,
              entryType: LedgerEntryType.debit,
              amountCents: amountCents || 0,
              currency: "USD",
              reason: d.reason,
              referenceType: "notes_import"
            }
          });
          createdDebtEntryIds.push(entry.id);
        } else continue;
        created.debts++;
      }

      for (const r of block.requests) {
        const note =
          block.personType === "client" ? `${block.personName}: ${r.note || r.title}` : r.note;
        const sr = await tx.stockRequest.create({
          data: {
            resellerId: block.resellerId,
            title: r.title,
            note: note ?? undefined,
            quantity: Math.min(500, Math.max(1, r.quantity)),
            status: "pending_approval"
          }
        });
        createdStockRequestIds.push(sr.id);
        created.requests++;
      }
    }
  });

  const firstLine = rawText
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .find((l: string) => l.length > 0) ?? "Nota importada";
  const title = firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
  const importId = randomUUID();

  await writeAuditLog({
    actorId,
    action: "notes.import.applied",
    entityType: "note_import",
    entityId: importId,
    meta: {
      title,
      rawText,
      created,
      createdResellerIds,
      createdClientIds,
      createdDebtEntryIds,
      createdStockRequestIds
    } satisfies NotesImportMeta
  });

  res.status(201).json({
    ok: true,
    importId,
    created: {
      resellers: created.resellers,
      clients: created.clients,
      debts: created.debts,
      requests: created.requests
    },
    message: `Se crearon ${created.resellers} revendedores, ${created.clients} clientes, ${created.debts} deudas y ${created.requests} encargues/tareas.`
  });
});

/** Aplica una vista previa editada (sin volver a parsear). Guarda IDs para poder revertir. */
notesRouter.post("/apply-preview", requireRole("admin"), async (req, res) => {
  const preview = req.body?.preview;
  if (
    !preview ||
    !Array.isArray(preview.createResellers) ||
    !Array.isArray(preview.createClients) ||
    !Array.isArray(preview.debtEntries) ||
    !Array.isArray(preview.stockRequests)
  ) {
    res.status(400).json({ message: "preview (createResellers, createClients, debtEntries, stockRequests) es requerido." });
    return;
  }
  const rawText = typeof req.body?.rawText === "string" ? req.body.rawText : "";

  const actorId = req.user!.id;
  const resellers = await prisma.reseller.findMany({ include: { user: true } });
  const clients = await prisma.client.findMany();
  const varios = await getOrCreateVariosReseller();
  const resellersWithVarios = [...resellers, { id: varios.id, user: { name: varios.name } }];
  const resellerMap = new Map<string, string>();
  const clientMap = new Map<string, string>();
  const createdResellerIds: Array<{ resellerId: string; userId: string }> = [];
  const createdClientIds: string[] = [];
  const createdDebtEntryIds: string[] = [];
  const createdStockRequestIds: string[] = [];
  const created = { resellers: 0, clients: 0, debts: 0, requests: 0 };

  async function ensureReseller(name: string): Promise<string> {
    if (name === "Varios") return varios.id;
    const existing = findBestResellerMatch(name, resellersWithVarios);
    if (existing) {
      resellerMap.set(name, existing.id);
      return existing.id;
    }
    const cached = resellerMap.get(name);
    if (cached) return cached;
    const email = `${slug(name)}${RESELLER_EMAIL_SUFFIX}`;
    const existingUser = await prisma.user.findFirst({
      where: { email, role: "reseller" }
    });
    if (existingUser) {
      const r = await prisma.reseller.findUnique({ where: { userId: existingUser.id } });
      if (r) {
        resellerMap.set(name, r.id);
        return r.id;
      }
    }
    const passwordHash = await bcrypt.hash(RESELLER_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { name, email, role: "reseller", passwordHash }
    });
    const reseller = await prisma.reseller.create({
      data: { userId: user.id, companyName: name }
    });
    resellerMap.set(name, reseller.id);
    created.resellers++;
    createdResellerIds.push({ resellerId: reseller.id, userId: user.id });
    await writeAuditLog({
      actorId,
      action: "reseller.created",
      entityType: "reseller",
      entityId: reseller.id,
      meta: { source: "notes_import" }
    });
    return reseller.id;
  }

  async function ensureClient(name: string, resellerId: string): Promise<string> {
    const existing = findBestClientMatch(name, clients);
    if (existing) return existing.id;
    const cached = clientMap.get(name);
    if (cached) return cached;
    const client = await prisma.client.create({
      data: { name, resellerId }
    });
    clientMap.set(name, client.id);
    created.clients++;
    createdClientIds.push(client.id);
    return client.id;
  }

  for (const r of preview.createResellers as Array<{ name: string }>) {
    if (r?.name?.trim()) await ensureReseller(r.name.trim());
  }
  for (const c of preview.createClients as Array<{ name: string; resellerName?: string }>) {
    if (c?.name?.trim()) await ensureClient(c.name.trim(), varios.id);
  }

  type DebtItem = { resellerName: string; reason: string; amountCents: number | null; currency: string };
  type RequestItem = { resellerName: string; title: string; quantity: number; note?: string | null };
  const debtPayloads: Array<{ resellerId: string; reason: string; amountCents: number; currency: "USD" | "ARS" }> = [];
  for (const d of preview.debtEntries as DebtItem[]) {
    const resellerId = await ensureReseller((d?.resellerName ?? "").trim() || "Varios");
    const amountCents = d.currency === "USD" && d.amountCents != null ? d.amountCents : 0;
    if (d.currency === "ARS" && d.amountCents != null) {
      debtPayloads.push({
        resellerId,
        reason: String(d.reason ?? "").trim(),
        amountCents: d.amountCents,
        currency: "ARS"
      });
    } else if (amountCents > 0 || (d.amountCents === null && String(d.reason ?? "").trim())) {
      debtPayloads.push({
        resellerId,
        reason: String(d.reason ?? "").trim(),
        amountCents: amountCents || 0,
        currency: "USD"
      });
    }
  }
  const requestPayloads: Array<{ resellerId: string; title: string; note?: string; quantity: number }> = [];
  for (const r of preview.stockRequests as RequestItem[]) {
    const resellerId = await ensureReseller((r?.resellerName ?? "").trim() || "Varios");
    requestPayloads.push({
      resellerId,
      title: String(r?.title ?? "").trim() || "Sin título",
      note: r?.note ?? undefined,
      quantity: Math.min(500, Math.max(1, Number(r?.quantity) || 1))
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const p of debtPayloads) {
      const entry = await tx.debtLedgerEntry.create({
        data: {
          resellerId: p.resellerId,
          entryType: LedgerEntryType.debit,
          amountCents: p.amountCents,
          currency: p.currency,
          reason: p.reason,
          referenceType: "notes_import"
        }
      });
      createdDebtEntryIds.push(entry.id);
      created.debts++;
    }
    for (const p of requestPayloads) {
      const sr = await tx.stockRequest.create({
        data: {
          resellerId: p.resellerId,
          title: p.title,
          note: p.note,
          quantity: p.quantity,
          status: "pending_approval"
        }
      });
      createdStockRequestIds.push(sr.id);
      created.requests++;
    }
  });

  const title =
    rawText.trim().split(/\r?\n/).map((l: string) => l.trim()).find((l: string) => l.length > 0)?.slice(0, 80) ??
    "Nota desde vista previa";
  const importId = randomUUID();
  await writeAuditLog({
    actorId,
    action: "notes.import.applied",
    entityType: "note_import",
    entityId: importId,
    meta: {
      title: title.length > 80 ? title.slice(0, 77) + "…" : title,
      rawText: rawText || "",
      created,
      createdResellerIds,
      createdClientIds,
      createdDebtEntryIds,
      createdStockRequestIds
    } satisfies NotesImportMeta
  });

  res.status(201).json({
    ok: true,
    importId,
    created: {
      resellers: created.resellers,
      clients: created.clients,
      debts: created.debts,
      requests: created.requests
    },
    message: `Se crearon ${created.resellers} revendedores, ${created.clients} clientes, ${created.debts} deudas y ${created.requests} encargues/tareas.`
  });
});
