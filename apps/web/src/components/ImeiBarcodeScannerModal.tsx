import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const SCANNER_DOM_ID = "imei-barcode-scanner-root";

/** Bip corto de confirmación al leer el código (Web Audio, sin archivo externo) */
function playBeep(): void {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    const ctx = new C();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.2;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignorar si el navegador no soporta o bloquea audio
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (imei: string) => void;
};

/**
 * Modal que abre la cámara y escanea códigos de barras 1D (Code 128, Code 39, EAN-13)
 * típicos de etiquetas IMEI/MEID. Al leer: bip, cierra y rellena el input IMEI.
 */
export function ImeiBarcodeScannerModal({ open, onClose, onScan }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const scannedRef = useRef(false);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;

    scannedRef.current = false;
    const elementId = SCANNER_DOM_ID;
    let mounted = true;
    let started = false;

    const config = {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.ITF,
      ] as Html5QrcodeSupportedFormats[],
      verbose: false,
    };

    const scanner = new Html5Qrcode(elementId, config);
    scannerRef.current = scanner;
    setError(null);
    setStarting(true);

    const cameraConfig = { facingMode: "environment" as const };
    const scanConfig = {
      fps: 10,
      qrbox: { width: 280, height: 120 },
      aspectRatio: 1.333,
    };

    const cameraUnavailableMessage =
      "No se pudo usar la cámara. En producción (HTTPS con certificado válido) funciona bien. " +
      "Si estás en el celular contra tu PC: el navegador a veces bloquea la cámara por el certificado autofirmado. " +
      "Probá aceptar el aviso de sitio no seguro en el celular y recargar, o cargar el IMEI a mano.";

    scanner
      .start(
        cameraConfig,
        scanConfig,
        (decodedText) => {
          if (!mounted || scannedRef.current) return;
          const digits = decodedText.replace(/\D/g, "");
          if (digits.length >= 10 && digits.length <= 20) {
            scannedRef.current = true;
            playBeep();
            onScanRef.current(digits);
            // No parar el scanner aquí: el padre cierra el modal y el cleanup del effect lo detiene.
            // Así se evita ver la pantalla en blanco un instante.
          }
        },
        () => {}
      )
      .then(() => {
        if (mounted) {
          started = true;
          setStarting(false);
        }
      })
      .catch((_err: Error) => {
        if (mounted) {
          setStarting(false);
          setError(cameraUnavailableMessage);
        }
      });

    return () => {
      mounted = false;
      scannerRef.current = null;
      if (started) {
        scanner.stop().catch(() => {}).finally(() => scanner.clear());
      } else {
        scanner.clear();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-label="Escanear código de barras IMEI">
      <div className="silva-modal" style={{ maxWidth: "min(100vw, 420px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 className="silva-modal-title" style={{ margin: 0 }}>Escanear IMEI</h3>
          <button type="button" className="silva-btn" onClick={onClose} aria-label="Cerrar">
            Cerrar
          </button>
        </div>
        <p className="silva-helper" style={{ marginBottom: 12 }}>
          Apuntá la cámara al código de barras del IMEI/MEID (etiqueta del equipo).
        </p>
        <div
          id={SCANNER_DOM_ID}
          style={{
            width: "100%",
            minHeight: 220,
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--silva-bg-subtle, #f1f3f4)",
          }}
        />
        {starting && !error && (
          <p className="silva-helper" style={{ marginTop: 8 }}>Iniciando cámara…</p>
        )}
        {error && (
          <div className="silva-alert" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
