/**
 * Label completo para mostrar un equipo (modelo + memoria + color).
 * Usa modelDisplay o purchaseOrderItem.displayModel cuando existen para mostrar la variante específica
 * (ej. "iPhone 13 Pro Max") en lugar del modelo de catálogo (ej. "iPhone 13 Pro / 13 Pro Max").
 */
export function deviceDisplayLabel(d: {
  model: string;
  modelDisplay?: string | null;
  memory?: string | null;
  color?: string | null;
  purchaseOrderItem?: { displayModel?: string | null } | null;
}): string {
  const model = deviceModelOnly(d);
  if (!model) return "—";
  const parts = [model, d.memory, d.color].filter(Boolean);
  return parts.join(" ") || model;
}

/** Nombre del modelo mostrable: variante específica cuando existe, sino el modelo de catálogo (sin " / ..."). */
export function deviceModelOnly(d: {
  model: string;
  modelDisplay?: string | null;
  purchaseOrderItem?: { displayModel?: string | null } | null;
}): string {
  if (d.purchaseOrderItem?.displayModel) return d.purchaseOrderItem.displayModel;
  if (d.modelDisplay) return d.modelDisplay;
  if (!d.model) return "—";
  const idx = d.model.indexOf(" / ");
  return idx > 0 ? d.model.slice(0, idx) : d.model;
}
