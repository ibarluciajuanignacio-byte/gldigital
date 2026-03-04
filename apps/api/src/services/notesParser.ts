/**
 * Parser de notas en texto plano (block de notas estilo Germán).
 * Segmenta por persona, clasifica revendedor/cliente, extrae deudas y encargues/tareas.
 * Sin llamadas a BD; solo lógica de texto.
 */

export type PersonType = "reseller" | "client";

export interface ParsedDebt {
  reason: string;
  amountCents: number | null;
  currency: "USD" | "ARS";
  rawLine: string;
}

export interface ParsedRequest {
  title: string;
  note: string | null;
  quantity: number;
  rawLine: string;
}

export interface ParsedBlock {
  personName: string;
  personType: PersonType;
  debts: ParsedDebt[];
  requests: ParsedRequest[];
  rawLines: string[];
}

const ACTION_PREFIXES = [
  /^cobrar\s+deuda\s+a\s+/i,
  /^consultar\s+a\s+/i,
  /^buscar\s+(el|la|lo)\s+/i,
  /^cambiar\s+bateria/i,
  /^conseguir\s+/i,
  /^consultar\s+/i
];

const CLIENT_KEYWORDS = /\b(cliente|clienta|tik\s*tok|señado\s*clienta|seña\s*clienta)\b/i;

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if line looks like an action (verb first), not a person name */
function isActionLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return ACTION_PREFIXES.some((re) => re.test(t));
}

/** Extract person name from action line, e.g. "cobrar deuda a emma azul" -> "emma azul" */
function personFromActionLine(line: string): string | null {
  const m = line.match(/cobrar\s+deuda\s+a\s+(.+)/i);
  if (m) return m[1].trim();
  const m2 = line.match(/consultar\s+a\s+(.+?)(?:\s*!*)?$/i);
  if (m2) return m2[1].trim();
  const m3 = line.match(/conseguir\s+.+?\s+para\s+(.+)/i);
  if (m3) return m3[1].trim();
  return null;
}

/** Title case for display; "MATI CASA IGLESIA" -> "Mati Casa Iglesia" */
function toTitleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function looksLikeDeviceLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  // Ejemplos típicos de equipos o ítems: "15 pro x2", "14 pro black 490", "17 sellado lavanda", "iphone 17 x2"
  if (/^iphone\b|^samsung\b|^apple\b/i.test(t)) return true;
  if (/^(\d{1,2})\s*(pro|max|plus|ultra)\b/i.test(t)) return true;
  if (/^\d{1,2}\s+sellado\b/i.test(t)) return true;
  if (/\bx\s*\d+\b/i.test(t)) return true;
  if (/\b(señado|seña|sellado|sealed|garantia|consignacion|consignación|camara|cámara)\b/i.test(lower)) return true;
  if (/\b(black|white|celeste|negro|lavanda|naranja|natural|blanco)\b/i.test(lower) && /\d/.test(lower)) return true;
  return false;
}

/** True if line looks like a person name (no leading verb, reasonable length) */
function looksLikePersonName(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (isActionLine(t)) return false;
  if (/^\d+([.,]\d+)?\s*(usd|dolares|pesos|ars)?$/i.test(t)) return false;
  if (/^adeuda\b/i.test(t)) return false;
  if (/^iphone\b|^samsung\b|^apple\b/i.test(t)) return false;
  // Si tiene números, casi seguro es un equipo/ítem, no un nombre.
  if (/\d/.test(t)) return false;
  if (looksLikeDeviceLine(t)) return false;
  return true;
}

function classifyPerson(personName: string, blockLines: string[]): PersonType {
  const allText = [personName, ...blockLines].join(" ").toLowerCase();
  if (CLIENT_KEYWORDS.test(allText)) return "client";
  return "reseller";
}

/** Parse amount from line: "adeuda 407 dolares" -> { amountCents: 40700, currency: 'USD' } */
function parseAmount(line: string): { amountCents: number; currency: "USD" | "ARS" } | null {
  if (typeof line !== "string" || !line) return null;
  const lower = line.toLowerCase();
  const hasUsd = /\b(usd|dolares?|dólares?)\b/.test(lower);
  const hasArs = /\b(ars|pesos)\b/.test(lower);

  const numMatch = line.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(?:usd|dolares?|dólares?|ars|pesos)?/i);
  if (!numMatch || numMatch[1] == null) return null;
  const rawNum = String(numMatch[1]).replace(/\./g, "").replace(",", ".");
  const num = parseFloat(rawNum);
  if (!Number.isFinite(num) || num <= 0) return null;

  if (hasArs) {
    return { amountCents: Math.round(num * 100), currency: "ARS" };
  }
  if (hasUsd) {
    return { amountCents: Math.round(num * 100), currency: "USD" };
  }
  const numOnly = line.replace(/[^\d.,]/g, "");
  if (numOnly.length >= 2) {
    return { amountCents: Math.round(num * 100), currency: "USD" };
  }
  return { amountCents: Math.round(num * 100), currency: "USD" };
}

function extractDebtsAndRequests(
  personName: string,
  personType: PersonType,
  lines: string[]
): { debts: ParsedDebt[]; requests: ParsedRequest[] } {
  const debts: ParsedDebt[] = [];
  const requests: ParsedRequest[] = [];

  let pendingAdeudaHeader = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pendingAdeudaHeader = false;
      continue;
    }

    if (/^adeuda\s*$/i.test(line)) {
      pendingAdeudaHeader = true;
      continue;
    }

    const lower = line.toLowerCase();
    const hasAdeuda = lower.includes("adeuda");
    const amountInfo = parseAmount(line);

    if (hasAdeuda && amountInfo) {
      debts.push({
        reason: line,
        amountCents: amountInfo.amountCents,
        currency: amountInfo.currency,
        rawLine: rawLine
      });
      pendingAdeudaHeader = false;
      continue;
    }

    if (hasAdeuda && !amountInfo) {
      debts.push({
        reason: line,
        amountCents: null,
        currency: "USD",
        rawLine: rawLine
      });
      pendingAdeudaHeader = false;
      continue;
    }

    if (pendingAdeudaHeader && (lower.includes("iphone") || lower.includes("pro") || lower.includes("samsung") || /^\d+\s*pro\b/.test(lower))) {
      requests.push({
        title: line.length > 100 ? line.slice(0, 97) + "…" : line,
        note: line.length > 100 ? line : null,
        quantity: 1,
        rawLine: rawLine
      });
      continue;
    }
    pendingAdeudaHeader = false;

    const isProduct =
      /iphone\s*\d+/i.test(line) ||
      /samsung\s*s?\d+/i.test(line) ||
      /apple\s*watch/i.test(line) ||
      /airpods/i.test(line) ||
      /lentes\s*rayban/i.test(line) ||
      /^\d+\s*pro\s+/i.test(line) ||
      /pro\s+(black|white|celeste|negro|lavanda|naranja|natural)/i.test(line);

    if (isProduct || line.length >= 3) {
      const qtyMatch = line.match(/x\s*(\d+)\b/i) || line.match(/\s+(\d+)\s*$/);
      const quantity = qtyMatch ? Math.min(500, Math.max(1, parseInt(qtyMatch[1], 10) || 1)) : 1;
      requests.push({
        title: line.length > 100 ? line.slice(0, 97) + "…" : line,
        note: null,
        quantity,
        rawLine: rawLine
      });
    }
  }

  return { debts, requests };
}

/**
 * Detecta "Nombre adeuda algo" en una sola línea y devuelve { name, rest } o null.
 */
function splitNameAdeuda(line: string): { name: string; rest: string } | null {
  const idx = line.toLowerCase().indexOf(" adeuda ");
  if (idx <= 0) return null;
  const namePart = line.slice(0, idx).trim();
  const rest = line.slice(idx).trim();
  if (namePart.length < 2 || namePart.length > 60) return null;
  if (/^\d+([.,]\d+)?\s*(usd|ars|pesos|dolares)?$/i.test(namePart)) return null;
  return { name: namePart, rest };
}

/**
 * Segmenta el texto en bloques: cada bloque tiene una persona (nombre) y sus líneas.
 * Líneas de acción ("cobrar deuda a X") generan un bloque con esa persona.
 * Líneas "Nombre adeuda ..." se dividen en nombre + primera línea.
 */
export function segmentBlocks(rawText: string): Array<{ personName: string; lines: string[]; isActionBlock: boolean }> {
  const raw = typeof rawText === "string" ? rawText : "";
  const allLines = raw.split(/\r?\n/).map((l) => (typeof l === "string" ? l.trim() : ""));
  const blocks: Array<{ personName: string; lines: string[]; isActionBlock: boolean }> = [];
  let currentName: string | null = null;
  let currentLines: string[] = [];
  let currentIsAction = false;

  const flush = () => {
    if (currentName != null && (currentLines.length > 0 || currentName !== "Varios")) {
      blocks.push({ personName: currentName, lines: [...currentLines], isActionBlock: currentIsAction });
    }
    currentName = null;
    currentLines = [];
    currentIsAction = false;
  };

  const looseLines: string[] = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line) {
      if (currentName != null) flush();
      continue;
    }

    if (isActionLine(line)) {
      const subject = personFromActionLine(line);
      if (subject) {
        flush();
        blocks.push({
          personName: toTitleCase(subject),
          lines: [line],
          isActionBlock: true
        });
      } else {
        flush();
        looseLines.push(line);
      }
      continue;
    }

    const nameAdeuda = splitNameAdeuda(line);
    if (nameAdeuda && looksLikePersonName(nameAdeuda.name)) {
      flush();
      currentName = toTitleCase(nameAdeuda.name);
      currentLines = [nameAdeuda.rest];
      currentIsAction = false;
      continue;
    }

    if (looksLikePersonName(line) && !/^adeuda\b/i.test(line)) {
      const prevWasBlank = i > 0 && !allLines[i - 1]?.trim();
      const nextLine = allLines[i + 1]?.trim() ?? "";
      const nextLooksLikeName = nextLine && looksLikePersonName(nextLine) && !isActionLine(nextLine);
      if (currentName != null && (prevWasBlank || nextLooksLikeName || currentLines.length > 0)) {
        flush();
      }
      currentName = toTitleCase(line);
      currentLines = [];
      currentIsAction = false;
      continue;
    }

    if (currentName != null) {
      currentLines.push(line);
    } else {
      looseLines.push(line);
    }
  }

  flush();
  if (looseLines.length > 0) {
    blocks.push({
      personName: "Varios",
      lines: looseLines,
      isActionBlock: false
    });
  }

  return blocks;
}

/**
 * Parsea el texto completo y devuelve bloques con persona, tipo, deudas y encargues.
 * No toca la BD. No lanza: ante cualquier fallo devuelve array vacío.
 */
export function parseNotesRaw(rawText: string): ParsedBlock[] {
  try {
    const rawBlocks = segmentBlocks(rawText);
    const result: ParsedBlock[] = [];

    for (const { personName, lines, isActionBlock } of rawBlocks) {
      const personType = classifyPerson(personName, lines);
      const { debts, requests } = extractDebtsAndRequests(personName, personType, lines);

      if (isActionBlock && lines[0]) {
        result.push({
          personName,
          personType: personType,
          debts: [],
          requests: [
            {
              title: lines[0].length > 100 ? lines[0].slice(0, 97) + "…" : lines[0],
              note: null,
              quantity: 1,
              rawLine: lines[0]
            }
          ],
          rawLines: lines
        });
      } else {
        result.push({
          personName,
          personType,
          debts,
          requests,
          rawLines: lines
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

/** Normalize name for matching: lowercase, no accents, single spaces */
export function normalizeNameForMatch(name: string): string {
  return normalizeName(name);
}

/**
 * Check if parsed name matches an existing name (containment).
 * "victor" matches "Victor Lattuada", "lattuada" matches "Victor Lattuada".
 */
export function nameMatches(parsedNormalized: string, existingNormalized: string): boolean {
  if (!parsedNormalized || !existingNormalized) return false;
  if (parsedNormalized === existingNormalized) return true;
  if (existingNormalized.includes(parsedNormalized)) return true;
  if (parsedNormalized.includes(existingNormalized)) return true;
  const pTokens = parsedNormalized.split(/\s+/).filter(Boolean);
  const eTokens = existingNormalized.split(/\s+/).filter(Boolean);
  const common = pTokens.filter((t) => eTokens.includes(t));
  if (common.length >= 1 && (pTokens.length === 1 || common.length === pTokens.length)) return true;
  return false;
}
