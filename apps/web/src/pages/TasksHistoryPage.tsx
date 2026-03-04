import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { Pencil, Trash2, ArrowLeft } from "lucide-react";

type CompletedTask = {
  id: string;
  title: string;
  resellerName: string;
  quantity: number;
  createdAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
  note?: string | null;
};

export function TasksHistoryPage() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<CompletedTask | null>(null);
  const [editResellerName, setEditResellerName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editResolvedNote, setEditResolvedNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTask, setDeleteTask] = useState<CompletedTask | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadTasks() {
    setLoading(true);
    api
      .get<{ completed: CompletedTask[] }>("/stock/requests/completed")
      .then((res) => setTasks(res.data.completed ?? []))
      .catch(() => setError("No se pudo cargar el historial."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTasks();
  }, []);

  function openEdit(t: CompletedTask) {
    setEditTask(t);
    setEditResellerName(t.resellerName ?? "");
    setEditTitle(t.title);
    setEditNote(t.note ?? "");
    const rawResolved = t.resolvedNote ?? "";
    const isRedundant = rawResolved.trim() && (
      rawResolved.trim() === `${t.resellerName}: ${t.title}`.trim() ||
      rawResolved.trim().startsWith(`${t.resellerName}: `)
    );
    setEditResolvedNote(isRedundant ? "" : rawResolved);
  }

  function closeEdit() {
    if (!savingEdit) setEditTask(null);
  }

  async function saveEdit() {
    if (!editTask) return;
    setSavingEdit(true);
    try {
      const { data } = await api.patch<{ request: CompletedTask & { note?: string | null; resolvedNote?: string | null; reseller?: { user: { name: string } } } }>(
        `/stock/requests/${editTask.id}`,
        {
          resellerName: editResellerName.trim(),
          title: editTitle.trim(),
          note: editNote.trim() || null,
          resolvedNote: editResolvedNote.trim() || null
        }
      );
      const newResellerName = data.request.reseller?.user?.name ?? editResellerName.trim();
      setTasks((prev) =>
        prev.map((r) =>
          r.id === editTask.id
            ? {
                ...r,
                resellerName: newResellerName,
                title: data.request.title,
                note: data.request.note ?? null,
                resolvedNote: data.request.resolvedNote ?? null
              }
            : r
        )
      );
      setEditTask(null);
    } finally {
      setSavingEdit(false);
    }
  }

  function openDelete(t: CompletedTask) {
    setDeleteTask(t);
  }

  function closeDelete() {
    if (!deletingId) setDeleteTask(null);
  }

  async function confirmDelete() {
    if (!deleteTask) return;
    const id = deleteTask.id;
    setDeletingId(id);
    try {
      await api.post(`/stock/requests/${id}/status`, { status: "cancelled" });
      setTasks((prev) => prev.filter((r) => r.id !== id));
      setDeleteTask(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <Link to="/notes" className="silva-btn" style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <ArrowLeft size={18} aria-hidden /> Volver a Notas
      </Link>
      <Box className="silva-home-section" style={{ marginBottom: 16 }}>
        <h2 className="silva-home-section__title" style={{ margin: 0 }}>
          Historial de tareas realizadas
        </h2>
        <p className="silva-helper" style={{ marginTop: 8 }}>
          Registro con fecha de creación y de cierre. Podés editar o eliminar ítems.
        </p>
        {error && <div className="silva-alert" style={{ marginTop: 12 }}>{error}</div>}
      </Box>

      {loading ? (
        <Box className="silva-home-section">
          <p className="silva-helper">Cargando…</p>
        </Box>
      ) : tasks.length === 0 ? (
        <Box className="silva-home-section">
          <p className="silva-helper">Aún no hay tareas marcadas como realizadas.</p>
        </Box>
      ) : (
        <Box className="silva-home-section">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--silva-border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {t.resellerName}: {t.title}
                    {t.quantity > 1 ? ` × ${t.quantity}` : ""}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--silva-muted)", marginTop: 6 }}>
                    Creada: {new Date(t.createdAt).toLocaleString("es-AR")}
                    {t.resolvedAt && ` · Realizada: ${new Date(t.resolvedAt).toLocaleString("es-AR")}`}
                  </div>
                  {t.resolvedNote && (
                    <div
                      style={{
                        fontSize: "0.9rem",
                        marginTop: 8,
                        padding: "8px 10px",
                        background: "var(--silva-bg-muted, rgba(0,0,0,0.04))",
                        borderRadius: 8
                      }}
                    >
                      {t.resolvedNote}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="silva-btn"
                    style={{ padding: "6px 8px", color: "var(--silva-muted)", borderColor: "var(--silva-border)" }}
                    onClick={() => openEdit(t)}
                    title="Editar"
                    aria-label={`Editar: ${t.title}`}
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="silva-btn"
                    style={{ padding: "6px 8px", color: "var(--silva-error, #c00)" }}
                    onClick={() => openDelete(t)}
                    title="Eliminar"
                    aria-label={`Eliminar: ${t.title}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Box>
      )}

      {editTask && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-history-title" onClick={closeEdit}>
          <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-history-title" className="silva-modal-title">Editar tarea realizada</h3>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>1. Título</label>
              <input
                type="text"
                className="silva-input"
                value={editResellerName}
                onChange={(e) => setEditResellerName(e.target.value)}
                placeholder="Ej: Varios, María García..."
                style={{ width: "100%", marginTop: 4 }}
                disabled={savingEdit}
              />
            </section>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>2. Descripción</label>
              <input
                type="text"
                className="silva-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ej: consultar envío a Chaco..."
                style={{ width: "100%", marginTop: 4 }}
                disabled={savingEdit}
              />
            </section>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>3. Notas</label>
              <textarea
                className="silva-input"
                value={editResolvedNote}
                onChange={(e) => setEditResolvedNote(e.target.value)}
                placeholder="Notas (opcional)"
                rows={2}
                style={{ width: "100%", resize: "vertical", marginTop: 4 }}
                disabled={savingEdit}
              />
            </section>

            <div className="silva-modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="silva-btn" onClick={closeEdit} disabled={savingEdit}>
                Cancelar
              </button>
              <button type="button" className="silva-btn silva-btn-primary" onClick={saveEdit} disabled={savingEdit || !editResellerName.trim() || !editTitle.trim()}>
                {savingEdit ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTask && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-history-title" onClick={closeDelete}>
          <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-history-title" className="silva-modal-title">¿Eliminar del historial?</h3>
            <p className="silva-modal-subtitle">
              <strong>{deleteTask.resellerName}</strong>: {deleteTask.title}
              {deleteTask.quantity > 1 ? ` × ${deleteTask.quantity}` : ""}
            </p>
            <p className="silva-helper" style={{ marginTop: 8 }}>Se quitará del listado. Esta acción no se puede deshacer.</p>
            <div className="silva-modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="silva-btn" onClick={closeDelete} disabled={!!deletingId}>
                Cancelar
              </button>
              <button
                type="button"
                className="silva-btn"
                style={{ borderColor: "var(--silva-error, #c00)", color: "var(--silva-error, #c00)" }}
                onClick={confirmDelete}
                disabled={!!deletingId}
              >
                {deletingId ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
