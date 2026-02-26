/**
 * Catálogo canónico de modelos iPhone (colores y almacenamientos oficiales Apple).
 * Fuente: listado cliente. Usado para validación en API y selectores en frontend.
 */

export type PhoneCatalogEntry = {
  model: string;
  label: string;
  colors: string[];
  storages: string[];
};

export const PHONE_CATALOG: PhoneCatalogEntry[] = [
  {
    model: "iPhone 11",
    label: "iPhone 11 (2019)",
    colors: ["Black", "Green", "Yellow", "Purple", "(PRODUCT)RED", "White"],
    storages: ["64 GB", "128 GB", "256 GB"]
  },
  {
    model: "iPhone 11 Pro",
    label: "iPhone 11 Pro (2019)",
    colors: ["Space Gray", "Silver", "Gold", "Midnight Green"],
    storages: ["64 GB", "256 GB", "512 GB"]
  },
  {
    model: "iPhone 11 Pro Max",
    label: "iPhone 11 Pro Max (2019)",
    colors: ["Space Gray", "Silver", "Gold", "Midnight Green"],
    storages: ["64 GB", "256 GB", "512 GB"]
  },
  {
    model: "iPhone 12 / 12 mini",
    label: "iPhone 12 / 12 mini (2020)",
    colors: ["Black", "White", "(PRODUCT)RED", "Green", "Blue", "Purple"],
    storages: ["64 GB", "128 GB", "256 GB"]
  },
  {
    model: "iPhone 12 Pro / 12 Pro Max",
    label: "iPhone 12 Pro / 12 Pro Max (2020)",
    colors: ["Silver", "Graphite", "Gold", "Pacific Blue"],
    storages: ["128 GB", "256 GB", "512 GB"]
  },
  {
    model: "iPhone 13 / 13 mini",
    label: "iPhone 13 / 13 mini (2021)",
    colors: ["Starlight", "Midnight", "Blue", "Pink", "(PRODUCT)RED", "Green"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 13 Pro / 13 Pro Max",
    label: "iPhone 13 Pro / 13 Pro Max (2021)",
    colors: ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 14 / 14 Plus",
    label: "iPhone 14 / 14 Plus (2022)",
    colors: ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 14 Pro / 14 Pro Max",
    label: "iPhone 14 Pro / 14 Pro Max (2022)",
    colors: ["Space Black", "Silver", "Gold", "Deep Purple"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 15 / 15 Plus",
    label: "iPhone 15 / 15 Plus (2023)",
    colors: ["Black", "White", "(PRODUCT)RED", "Blue", "Green", "Yellow"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 15 Pro / 15 Pro Max",
    label: "iPhone 15 Pro / 15 Pro Max (2023)",
    colors: ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 16 / 16 Plus",
    label: "iPhone 16 / 16 Plus (2024)",
    colors: ["Ultramarine", "Teal", "Pink", "White", "Black"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 16 Pro / 16 Pro Max",
    label: "iPhone 16 Pro / 16 Pro Max (2024)",
    colors: ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"],
    storages: ["128 GB", "256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 17",
    label: "iPhone 17 (2025)",
    colors: ["Lavender", "Sage Green", "Mist Blue", "Titanium", "Orange"],
    storages: ["256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 17 Pro",
    label: "iPhone 17 Pro (2025)",
    colors: ["Lavender", "Sage Green", "Mist Blue", "Titanium", "Orange"],
    storages: ["256 GB", "512 GB", "1 TB"]
  },
  {
    model: "iPhone 17 Pro Max",
    label: "iPhone 17 Pro Max (2025)",
    colors: ["Lavender", "Sage Green", "Mist Blue", "Titanium", "Orange"],
    storages: ["256 GB", "512 GB", "1 TB", "2 TB"]
  }
];

export function getPhoneCatalog(): PhoneCatalogEntry[] {
  return PHONE_CATALOG;
}

export function getEntryByModel(model: string): PhoneCatalogEntry | undefined {
  return PHONE_CATALOG.find((e) => e.model === model);
}

export function isValidModelMemoryColor(
  model: string,
  memory: string,
  color: string
): boolean {
  const entry = getEntryByModel(model);
  if (!entry) return false;
  return (
    entry.storages.includes(memory) && entry.colors.includes(color)
  );
}

export function getDisplayLabel(model: string, memory: string, color: string): string {
  return `${model} ${memory} ${color}`.trim();
}
