/**
 * Detecta si el usuario está en un dispositivo móvil (para mostrar escáner de cámara en lugar de solo teclado).
 * Usa userAgent y touch + ancho de pantalla para mayor precisión.
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.innerWidth < 768;
  const mobileKeywords = /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  return (mobileKeywords.test(ua) && hasTouch) || (hasTouch && smallScreen);
}
