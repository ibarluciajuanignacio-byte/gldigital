import { useRef, useState } from "react";
import { LordIcon } from "./LordIcon";
import { isMobile } from "../utils/isMobile";
import { Camera, Keyboard } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onOpenScanner: () => void;
  id?: string;
  "aria-label"?: string;
};

/**
 * Campo IMEI que en móvil, al tocar, muestra dos opciones: escanear con cámara o ingresar manualmente.
 * En desktop el campo es siempre editable y el ícono abre el escáner.
 */
export function ImeiInputWithMobileChoice({
  value,
  onChange,
  placeholder,
  onOpenScanner,
  id,
  "aria-label": ariaLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [manualEntryChosen, setManualEntryChosen] = useState(false);
  const mobile = isMobile();

  const handleWrapperClick = () => {
    if (!mobile) return;
    if (manualEntryChosen) return; // input is editable, let it focus
    setShowChoiceModal(true);
  };

  const handleChooseCamera = () => {
    setShowChoiceModal(false);
    onOpenScanner();
  };

  const handleChooseManual = () => {
    setShowChoiceModal(false);
    setManualEntryChosen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isReadOnly = mobile && !manualEntryChosen;

  return (
    <>
      <div
        className="silva-input-with-icon"
        role={mobile ? "button" : undefined}
        tabIndex={mobile ? 0 : undefined}
        onClick={handleWrapperClick}
        onKeyDown={(e) => {
          if (mobile && (e.key === "Enter" || e.key === " ") && !manualEntryChosen) {
            e.preventDefault();
            setShowChoiceModal(true);
          }
        }}
        style={mobile ? { cursor: "pointer" } : undefined}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="silva-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            mobile
              ? manualEntryChosen
                ? "Ingresar IMEI (solo dígitos)"
                : "Tocá para escanear o ingresar manualmente"
              : placeholder ?? "Escanear o ingresar IMEI"
          }
          readOnly={isReadOnly}
          aria-label={ariaLabel ?? (mobile ? "IMEI (tocá para elegir escanear o ingresar manual)" : "IMEI")}
        />
        {!mobile && (
          <span
            className="silva-input-with-icon__suffix"
            aria-hidden
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onOpenScanner();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenScanner();
              }
            }}
          >
            <LordIcon name="barcode" size={18} />
          </span>
        )}
        {mobile && !manualEntryChosen && (
          <span className="silva-input-with-icon__suffix" aria-hidden>
            <LordIcon name="barcode" size={18} />
          </span>
        )}
      </div>

      {mobile && showChoiceModal && (
        <div
          className="silva-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Cómo cargar el IMEI"
          onClick={() => setShowChoiceModal(false)}
        >
          <div className="silva-modal" style={{ maxWidth: "min(100vw, 320px)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="silva-modal-title" style={{ margin: 0, marginBottom: 8 }}>
              Cargar IMEI
            </h3>
            <p className="silva-helper" style={{ marginBottom: 16 }}>
              Escanear con la cámara o ingresar los dígitos a mano.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="silva-btn silva-btn-primary"
                onClick={handleChooseCamera}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
              >
                <Camera size={20} aria-hidden />
                Escanear con cámara
              </button>
              <button
                type="button"
                className="silva-btn"
                onClick={handleChooseManual}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
              >
                <Keyboard size={20} aria-hidden />
                Ingresar manualmente
              </button>
            </div>
            <button
              type="button"
              className="silva-btn silva-btn-ghost"
              style={{ marginTop: 12, width: "100%" }}
              onClick={() => setShowChoiceModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
