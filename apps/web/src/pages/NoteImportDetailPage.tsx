import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { AddNoteModal } from "../components/AddNoteModal";

type NoteImport = {
  id: string;
  title: string;
  createdAt: string;
  rawText: string;
  created: { resellers: number; clients: number; debts: number; requests: number };
};

export function NoteImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<NoteImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reimportOpen, setReimportOpen] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/notes/imports/${encodeURIComponent(id)}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        const msg = err?.response?.data?.message ?? "No se pudo cargar la nota.";
        setError(msg);
        setData(null);
      });
  }, [id]);

  async function handleRevert() {
    if (!id || !data) return;
    if (!confirm("¿Deshacer esta carga? Se eliminarán los revendedores, clientes, deudas y encargues creados en esta importación. Esta acción no se puede deshacer.")) return;
    setError(null);
    setReverting(true);
    try {
      await api.post(`/notes/imports/${encodeURIComponent(id)}/revert`);
      setData(null);
      navigate("/notes");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "No se pudo revertir la carga.";
      setError(msg);
    } finally {
      setReverting(false);
    }
  }

  return (
    <div>
      <Box className="silva-home-section" style={{ marginBottom: 16 }}>
        <div className="silva-home-section__head" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="silva-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} aria-hidden /> Volver
          </button>
          {data && (
            <>
              <button
                type="button"
                className="silva-btn"
                style={{ borderColor: "var(--silva-error, #c00)", color: "var(--silva-error, #c00)" }}
                onClick={handleRevert}
                disabled={reverting}
              >
                {reverting ? "Revirtiendo…" : "Deshacer esta carga"}
              </button>
              <button type="button" className="silva-btn silva-btn-primary" onClick={() => setReimportOpen(true)}>
                Reimportar / editar
              </button>
            </>
          )}
        </div>
        <h3 style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <FileText size={18} aria-hidden />
          {data?.title ?? "Nota"}
        </h3>
        {data && (
          <div style={{ color: "var(--silva-muted)", marginTop: 6 }}>
            {new Date(data.createdAt).toLocaleString("es-AR")}
            {" · "}
            {data.created.requests} tareas · {data.created.debts} deudas · {data.created.resellers} revendedores · {data.created.clients} clientes
          </div>
        )}
        {error && <div className="silva-alert" style={{ marginTop: 12 }}>{error}</div>}
      </Box>

      {data && (
        <Box className="silva-home-section">
          <h4 style={{ marginTop: 0 }}>Texto pegado</h4>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(0,0,0,0.04)",
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--silva-border)",
              margin: 0
            }}
          >
            {data.rawText}
          </pre>
          <p className="silva-helper" style={{ marginTop: 10 }}>
            “Reimportar / editar” abre el pegado de nota con el texto cargado para corregirlo y volver a cargar una nueva nota (no borra lo anterior).
          </p>
        </Box>
      )}

      {reimportOpen && data && (
        <div
          className="silva-modal-backdrop silva-mobile-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Reimportar nota"
          onClick={() => setReimportOpen(false)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <AddNoteModal
            initialRawText={data.rawText}
            onClose={() => setReimportOpen(false)}
            onSuccess={() => navigate("/notes")}
          />
        </div>
      )}
    </div>
  );
}

