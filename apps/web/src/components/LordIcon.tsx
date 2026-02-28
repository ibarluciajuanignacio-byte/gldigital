/**
 * Lordicon: usa el script en el footer (cdn.lordicon.com/ritcuqlt.js).
 * Iconos en /lordicons/*.json (dashboard, stock, proveedores, etc.)
 * Usa ThemeContext para actualizar colores al cambiar light/dark sin recargar.
 */
import { createElement, type CSSProperties } from "react";
import { useTheme } from "../context/ThemeContext";

export const LORDICON_NAMES = [
  "barcode",
  "caja",
  "chat",
  "check",
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

/** Light: negro para la parte principal, azul para el acento */
const LIGHT_PRIMARY = "#0B1014";
const PROJECT_BLUE = "#033C57";
/** Dark: blanco para la parte principal, azul para el acento */
const DARK_PRIMARY = "#e4e5e7";
const DARK_SECONDARY = "#2F7E9D";

function isDarkModeFromDom(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function LordIcon({
  name,
  size = 24,
  trigger = "hover",
  primary,
  secondary,
  className,
  style,
}: Props) {
  const themeFromContext = useTheme();
  const dark = themeFromContext ?? isDarkModeFromDom();
  /* En light: siempre negro lo que no es azul. En dark: blanco lo que no es azul. */
  const primaryColor = dark ? (primary ?? DARK_PRIMARY) : (primary ?? LIGHT_PRIMARY);
  const secondaryColor = dark ? (secondary ?? DARK_SECONDARY) : (secondary ?? PROJECT_BLUE);
  const src = `/lordicons/${name}.json`;
  const colors = `primary:${primaryColor},secondary:${secondaryColor}`;
  return createElement("lord-icon", {
    key: dark ? "dark" : "light",
    src,
    trigger,
    colors,
    class: className ?? undefined,
    style: { width: size, height: size, ...style },
  } as Record<string, unknown>);
}
