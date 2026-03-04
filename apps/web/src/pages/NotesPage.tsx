import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";

type NotesImport = {
  id: string;
  title: string;
  createdAt: string;
  created: { resellers: number; clients: number; debts: number; requests: number };
};

export function NotesPage() {
  const navigate = useNavigate();
  const [imports, setImports] = useState<NotesImport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/notes/imports")
      .then((res) => setImports(res.data.imports ?? []))
      .catch((err) => {
        const msg = err?.response?.data?.message ?? "No se pudieron cargar las notas.";
        setError(msg);
        setImports([]);
      });
  }, []);

  return (
    <div>
      <Box className="silva-home-section" style={{ marginBottom: 16 }}>
        <div className="silva-home-section__head">
          <h3 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <FileText size={18} aria-hidden />
            Notas importadas
          </h3>
        </div>
        <p className="silva-helper" style={{ marginTop: 8 }}>
          Historial de notas que se interpretaron y se cargaron en el sistema.
        </p>
        <p style={{ marginTop: 8, fontSize: "0.9rem", display: "flex", flexWrap: "wrap", gap: "12px 16px" }}>
          <a href="/notes/tasks-history" onClick={(e) => { e.preventDefault(); navigate("/notes/tasks-history"); }} style={{ color: "var(--silva-muted)" }}>
            Historial de tareas realizadas
          </a>
          <a href="/notes/cleanup" onClick={(e) => { e.preventDefault(); navigate("/notes/cleanup"); }} style={{ color: "var(--silva-muted)" }}>
            ¿Cargaste una nota antes de tener esta sección? Podés borrar esos datos acá.
          </a>
        </p>
        {error && <div className="silva-alert" style={{ marginTop: 12 }}>{error}</div>}
      </Box>

      {imports.length === 0 ? (
        <Box className="silva-home-section">
          <div className="silva-helper">No hay notas importadas todavía.</div>
        </Box>
      ) : (
        <Box className="silva-home-section">
          <div style={{ display: "grid", gap: 10 }}>
            {imports.map((n) => (
              <button
                key={n.id}
                type="button"
                className="silva-home-kpi-card silva-home-kpi-card--clickable"
                style={{ textAlign: "left" }}
                onClick={() => navigate(`/notes/${encodeURIComponent(n.id)}`)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                    <div style={{ color: "var(--silva-muted)", fontSize: "0.9rem", marginTop: 2 }}>
                      {new Date(n.createdAt).toLocaleString("es-AR")}
                      {" · "}
                      {n.created.requests} tareas
                      {" · "}
                      {n.created.debts} deudas
                      {" · "}
                      {n.created.resellers} revendedores
                      {" · "}
                      {n.created.clients} clientes
                    </div>
                  </div>
                  <ArrowRight size={18} aria-hidden />
                </div>
              </button>
            ))}
          </div>
        </Box>
      )}
    </div>
  );
}

