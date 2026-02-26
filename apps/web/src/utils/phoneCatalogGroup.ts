/**
 * Agrupa el catálogo de teléfonos por modelo base (ej. iPhone 13) y versión (ej. Pro / 13 Pro Max).
 * Para selects: primero Modelo, luego Versión, después Memoria y Color.
 */

export type PhoneCatalogEntry = {
  model: string;
  label: string;
  colors: string[];
  storages: string[];
};

const BASE_REGEX = /^iPhone \d+/;

export function getBaseModel(entry: PhoneCatalogEntry): string {
  const match = entry.model.match(BASE_REGEX);
  return match ? match[0] : entry.model;
}

/** Lista de modelos base únicos, ordenados (iPhone 11, 12, 13...) */
export function getBaseModels(catalog: PhoneCatalogEntry[]): string[] {
  const bases = [...new Set(catalog.map(getBaseModel))];
  return bases.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}

/** Entradas del catálogo que corresponden a un modelo base */
export function getVariantsForBase(catalog: PhoneCatalogEntry[], base: string): PhoneCatalogEntry[] {
  return catalog.filter((c) => getBaseModel(c) === base);
}

export type VersionOption = {
  value: "" | "Plus" | "Pro" | "Pro Max";
  label: string;
  model: string;
};

/**
 * Opciones de versión: en blanco (modelo base), Plus, Pro, Pro Max.
 * Si el modelo base incluye Plus (ej. "iPhone 16 / 16 Plus"), se ofrece "Plus" como opción.
 */
export function getVersionOptions(catalog: PhoneCatalogEntry[], base: string): VersionOption[] {
  const variants = getVariantsForBase(catalog, base);
  const baseEntry = variants.find((v) => !v.model.includes("Pro"));
  const plusEntry = variants.find((v) => v.model.includes("Plus") && !v.model.includes("Pro"));
  const proMaxEntry = variants.find((v) => v.model.includes("Pro Max"));
  const proEntry = variants.find((v) => v.model.includes("Pro") && !v.model.includes("Pro Max"));

  const options: VersionOption[] = [];
  if (baseEntry) options.push({ value: "", label: "—", model: baseEntry.model });
  if (plusEntry) options.push({ value: "Plus", label: "Plus", model: plusEntry.model });
  if (proEntry) options.push({ value: "Pro", label: "Pro", model: proEntry.model });
  else if (proMaxEntry) options.push({ value: "Pro", label: "Pro", model: proMaxEntry.model });
  if (proMaxEntry) options.push({ value: "Pro Max", label: "Pro Max", model: proMaxEntry.model });
  return options;
}

/** Dado base y versión ("", "Plus", "Pro", "Pro Max"), devuelve el model del catálogo. */
export function getModelForVersionKey(
  catalog: PhoneCatalogEntry[],
  base: string,
  versionKey: "" | "Plus" | "Pro" | "Pro Max"
): string {
  const opts = getVersionOptions(catalog, base);
  const found = opts.find((o) => o.value === versionKey);
  return found?.model ?? "";
}
