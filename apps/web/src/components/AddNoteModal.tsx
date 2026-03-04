import { useState } from "react";
import { api } from "../api/client";
import { X } from "lucide-react";

export type Preview = {
  createResellers: Array<{ name: string }>;
  createClients: Array<{ name: string; resellerName?: string }>;
  debtEntries: Array<{
    resellerName: string;
    reason: string;
    amountCents: number | null;
    currency: string;
  }>;
  stockRequests: Array<{
    resellerName: string;
    title: string;
    quantity: number;
    note?: string | null;
  }>;
  matchedResellers: Array<{ parsedName: string; matchedName: string }>;
  matchedClients: Array<{ parsedName: string; matchedName: string }>;
};

function clonePreview(p: Preview): Preview {
  return JSON.parse(JSON.stringify(p));
}

type Props = {
  onClose: () => void;
  onSuccess?: () => void;
  initialRawText?: string;
};

export function AddNoteModal({ onClose, onSuccess, initialRawText }: Props) {
  const [rawText, setRawText] = useState(initialRawText ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  /** Vista previa editable: se puede quitar ítems antes de cargar */
  const [editedPreview, setEditedPreview] = useState<Preview | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function extractApiError(err: unknown, fallback: string): string {
    const anyErr = err as any;
    const status: number | undefined = anyErr?.response?.status;
    const data = anyErr?.response?.data;
    const message =
      data?.message ??
      data?.error ??
      (typeof anyErr?.message === "string" ? anyErr.message : null) ??
      null;

    if (status && message) return `${status}: ${message}`;
    if (status) return `${status}: ${fallback}`;
    return message ?? fallback;
  }

  async function handleParse() {
    const text = rawText.trim();
    if (!text) {
      setError("Escribí o pegá el texto de la nota.");
      return;
    }
    setError(null);
    setParseLoading(true);
    try {
      const { data } = await api.post<{ preview: Preview }>("/notes/parse", { rawText: text });
      setPreview(data.preview);
      setEditedPreview(clonePreview(data.preview));
    } catch (err: unknown) {
      setError(extractApiError(err, "No se pudo interpretar la nota."));
      setPreview(null);
      setEditedPreview(null);
    } finally {
      setParseLoading(false);
    }
  }

  async function handleApply() {
    if (!editedPreview) {
      setError("Interpretá primero la nota para ver la vista previa y luego cargarla.");
      return;
    }
    setError(null);
    setApplyLoading(true);
    try {
      await api.post("/notes/apply-preview", {
        preview: editedPreview,
        rawText: rawText.trim() || undefined
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(extractApiError(err, "No se pudo cargar la nota."));
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Agregar nota">
      <h3 className="silva-modal-title">Agregar nota</h3>
      <p className="silva-modal-subtitle">
        Pegá el texto de tu nota. El sistema lo interpreta y te muestra qué va a cargar antes de confirmar.
      </p>

      <p className="silva-label" style={{ marginTop: 0, fontSize: "0.85rem", color: "var(--silva-muted)" }}>
        Tip: poné siempre el nombre de la persona primero y, si es la misma, escribilo igual. Para montos usá &quot;USD&quot; o &quot;dolares&quot; y &quot;ARS&quot; o &quot;pesos&quot;.
      </p>

      <label className="silva-label" style={{ marginTop: 12 }}>Texto de la nota</label>
      <textarea
        className="silva-input"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Pegá acá el contenido de tu block de notas..."
        rows={8}
        style={{ resize: "vertical", minHeight: 120 }}
        disabled={applyLoading}
      />

      {error && <div className="silva-alert" style={{ marginTop: 12 }}>{error}</div>}

      <div className="silva-modal-actions" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className="silva-btn"
          onClick={onClose}
          disabled={parseLoading || applyLoading}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="silva-btn silva-btn-primary"
          onClick={handleParse}
          disabled={parseLoading || applyLoading}
        >
          {parseLoading ? "Interpretando…" : "Interpretar"}
        </button>
      </div>

      {editedPreview && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--silva-border)" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Vista previa</h4>
          <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--silva-muted)" }}>
            Podés quitar ítems que estén mal (ej. equipos detectados como revendedores) antes de cargar.
          </p>

          {editedPreview.matchedResellers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: "0.85rem" }}>Se asocian a revendedores existentes:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: "0.9rem" }}>
                {editedPreview.matchedResellers.map((m, i) => (
                  <li key={i}>«{m.parsedName}» → {m.matchedName}</li>
                ))}
              </ul>
            </div>
          )}

          {editedPreview.matchedClients.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: "0.85rem" }}>Se asocian a clientes existentes:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: "0.9rem" }}>
                {editedPreview.matchedClients.map((m, i) => (
                  <li key={i}>«{m.parsedName}» → {m.matchedName}</li>
                ))}
              </ul>
            </div>
          )}

          {editedPreview.createResellers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: "0.85rem" }}>Se van a crear revendedores:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: "0.9rem", listStyle: "none", paddingLeft: 0 }}>
                {editedPreview.createResellers.map((r, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span>{r.name}</span>
                    <button
                      type="button"
                      className="silva-btn"
                      style={{ padding: "2px 8px", minHeight: 0, fontSize: "0.8rem" }}
                      onClick={() => setEditedPreview((p) => p ? { ...p, createResellers: p.createResellers.filter((_, j) => j !== i) } : null)}
                      title="Quitar de la lista"
                      aria-label={`Quitar ${r.name}`}
                    >
                      <X size={14} aria-hidden /> Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editedPreview.createClients.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: "0.85rem" }}>Se van a crear clientes:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: "0.9rem", listStyle: "none", paddingLeft: 0 }}>
                {editedPreview.createClients.map((c, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span>{c.name}{c.resellerName ? ` (${c.resellerName})` : ""}</span>
                    <button
                      type="button"
                      className="silva-btn"
                      style={{ padding: "2px 8px", minHeight: 0, fontSize: "0.8rem" }}
                      onClick={() => setEditedPreview((p) => p ? { ...p, createClients: p.createClients.filter((_, j) => j !== i) } : null)}
                      title="Quitar de la lista"
                      aria-label={`Quitar ${c.name}`}
                    >
                      <X size={14} aria-hidden /> Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editedPreview.debtEntries.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: "0.85rem" }}>Deudas a cargar:</strong>
              <div style={{ maxHeight: 220, overflow: "auto", marginTop: 6, paddingRight: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9rem", listStyle: "none", paddingLeft: 0 }}>
                  {editedPreview.debtEntries.map((d, i) => (
                    <li key={i} style={{ marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span>
                        {d.resellerName}: {d.reason}
                        {d.amountCents != null && ` (${(d.amountCents / 100).toFixed(2)} ${d.currency})`}
                      </span>
                      <button
                        type="button"
                        className="silva-btn"
                        style={{ padding: "2px 8px", minHeight: 0, fontSize: "0.8rem", flexShrink: 0 }}
                        onClick={() => setEditedPreview((p) => p ? { ...p, debtEntries: p.debtEntries.filter((_, j) => j !== i) } : null)}
                        title="Quitar de la lista"
                        aria-label="Quitar esta deuda"
                      >
                        <X size={14} aria-hidden /> Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {editedPreview.stockRequests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: "0.85rem" }}>Encargues / tareas:</strong>
              <div style={{ maxHeight: 260, overflow: "auto", marginTop: 6, paddingRight: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9rem", listStyle: "none", paddingLeft: 0 }}>
                  {editedPreview.stockRequests.map((r, i) => (
                    <li key={i} style={{ marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span>
                        {r.resellerName}: {r.title}
                        {r.quantity > 1 ? ` x${r.quantity}` : ""}
                        {r.note ? <div style={{ color: "var(--silva-muted)", fontSize: "0.85rem", marginTop: 2 }}>{r.note}</div> : null}
                      </span>
                      <button
                        type="button"
                        className="silva-btn"
                        style={{ padding: "2px 8px", minHeight: 0, fontSize: "0.8rem", flexShrink: 0 }}
                        onClick={() => setEditedPreview((p) => p ? { ...p, stockRequests: p.stockRequests.filter((_, j) => j !== i) } : null)}
                        title="Quitar de la lista"
                        aria-label="Quitar este encargue"
                      >
                        <X size={14} aria-hidden /> Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="silva-modal-actions" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="silva-btn silva-btn-primary"
              onClick={handleApply}
              disabled={applyLoading}
            >
              {applyLoading ? "Cargando…" : "Cargar todo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
