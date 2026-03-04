import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { useNavigate } from "react-router-dom";
import { Trash2, ArrowLeft } from "lucide-react";

type Candidate = { id: string; name: string; createdAt: string };

export function NotesCleanupPage() {
  const navigate = useNavigate();
  const [resellers, setResellers] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<Candidate[]>([]);
  const [selectedResellerIds, setSelectedResellerIds] = useState<Set<string>>(new Set());
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ resellers: Candidate[]; clients: Candidate[] }>("/notes/cleanup-candidates")
      .then((res) => {
        setResellers(res.data.resellers ?? []);
        setClients(res.data.clients ?? []);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? "No se pudieron cargar los candidatos.");
        setResellers([]);
        setClients([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleReseller(id: string) {
    setSelectedResellerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleClient(id: string) {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    const rIds = Array.from(selectedResellerIds);
    const cIds = Array.from(selectedClientIds);
    if (rIds.length === 0 && cIds.length === 0) {
      setError("Seleccioná al menos un revendedor o un cliente.");
      return;
    }
    if (!confirm(`¿Borrar ${rIds.length} revendedores y ${cIds.length} clientes? Se eliminarán también sus tareas y deudas. Esta acción no se puede deshacer.`)) return;
    setError(null);
    setDeleting(true);
    try {
      await api.post("/notes/cleanup", { resellerIds: rIds, clientIds: cIds });
      setResellers((prev) => prev.filter((r) => !selectedResellerIds.has(r.id)));
      setClients((prev) => prev.filter((c) => !selectedClientIds.has(c.id)));
      setSelectedResellerIds(new Set());
      setSelectedClientIds(new Set());
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.message ?? "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  }

  const totalSelected = selectedResellerIds.size + selectedClientIds.size;

  return (
    <div>
      <Box className="silva-home-section" style={{ marginBottom: 16 }}>
        <div className="silva-home-section__head" style={{ flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="silva-btn" onClick={() => navigate("/notes")}>
            <ArrowLeft size={16} aria-hidden /> Volver a Notas
          </button>
        </div>
        <h3 style={{ marginTop: 12, marginBottom: 0 }}>Limpiar carga anterior (sin registro)</h3>
        <p className="silva-helper" style={{ marginTop: 8 }}>
          Si cargaste una nota antes de que existiera la sección Notas, esa carga no aparece en el listado. Acá podés borrar revendedores y clientes creados en las últimas 24 horas (y sus tareas/deudas). Marcá solo los que quieras eliminar.
        </p>
        {error && <div className="silva-alert" style={{ marginTop: 12 }}>{error}</div>}
      </Box>

      {loading ? (
        <Box className="silva-home-section"><div className="silva-helper">Cargando…</div></Box>
      ) : resellers.length === 0 && clients.length === 0 ? (
        <Box className="silva-home-section">
          <div className="silva-helper">No hay revendedores ni clientes creados en las últimas 24 horas.</div>
        </Box>
      ) : (
        <>
          {resellers.length > 0 && (
            <Box className="silva-home-section" style={{ marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Revendedores creados en las últimas 24 h</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {resellers.map((r) => (
                  <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      id={`reseller-${r.id}`}
                      checked={selectedResellerIds.has(r.id)}
                      onChange={() => toggleReseller(r.id)}
                    />
                    <label htmlFor={`reseller-${r.id}`} style={{ flex: 1, cursor: "pointer" }}>
                      {r.name}
                      <span style={{ color: "var(--silva-muted)", fontSize: "0.85rem", marginLeft: 8 }}>
                        {new Date(r.createdAt).toLocaleString("es-AR")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Box>
          )}
          {clients.length > 0 && (
            <Box className="silva-home-section" style={{ marginBottom: 16 }}>
              <h4 style={{ marginTop: 0 }}>Clientes (Varios) creados en las últimas 24 h</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {clients.map((c) => (
                  <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      id={`client-${c.id}`}
                      checked={selectedClientIds.has(c.id)}
                      onChange={() => toggleClient(c.id)}
                    />
                    <label htmlFor={`client-${c.id}`} style={{ flex: 1, cursor: "pointer" }}>
                      {c.name}
                      <span style={{ color: "var(--silva-muted)", fontSize: "0.85rem", marginLeft: 8 }}>
                        {new Date(c.createdAt).toLocaleString("es-AR")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Box>
          )}
          <Box className="silva-home-section">
            <button
              type="button"
              className="silva-btn"
              style={{ borderColor: "var(--silva-error, #c00)", color: "var(--silva-error, #c00)" }}
              onClick={handleDelete}
              disabled={deleting || totalSelected === 0}
            >
              <Trash2 size={16} aria-hidden /> {deleting ? "Borrando…" : `Borrar seleccionados (${totalSelected})`}
            </button>
          </Box>
        </>
      )}
    </div>
  );
}
