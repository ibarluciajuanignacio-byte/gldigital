/**
 * Lordicon: usa el script en el footer (cdn.lordicon.com/ritcuqlt.js).
 * Iconos en /lordicons/*.json (dashboard, stock, proveedores, etc.)
 */
import { createElement, type CSSProperties } from "react";

export const LORDICON_NAMES = [
  "barcode",
  "caja",
  "chat",
  "clientes",
  "coonsignacion",
  "dashboard",
  "deuda",
  "map",
  "orden_compra",
  "proveedores",
  "resellers",
  "stock",
  "tecnicios",
] as const;

export type LordIconName = (typeof LORDICON_NAMES)[number];

type Props = {
  name: LordIconName;
  size?: number;
  trigger?: "hover" | "click" | "loop" | "morph" | "in";
  primary?: string;
  secondary?: string;
  className?: string;
  style?: CSSProperties;
};

/** Azul del proyecto (--silva-primary) para el color secundario de los Lordicons */
const PROJECT_BLUE = "#033C57";

export function LordIcon({
  name,
  size = 24,
  trigger = "hover",
  primary = "#0B1014",
  secondary = PROJECT_BLUE,
  className,
  style,
}: Props) {
  const src = `/lordicons/${name}.json`;
  const colors = `primary:${primary},secondary:${secondary}`;
  return createElement("lord-icon", {
    src,
    trigger,
    colors,
    class: className ?? undefined,
    style: { width: size, height: size, ...style },
  });
}
