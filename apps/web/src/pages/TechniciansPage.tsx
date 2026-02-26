import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";

type Technician = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  _count?: { devices: number };
};

export function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });

  async function load() {
    try {
      const { data } = await api.get<{ technicians: Technician[] }>("/technicians");
      setTechnicians(data.technicians ?? []);
    } catch {
      setError("No se pudo cargar técnicos.");
      setTechnicians([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/technicians", {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined
      });
      setForm({ name: "", phone: "", email: "" });
      await load();
    } catch (err: unknown) {
      const res = err as { response?: { data?: { message?: string } } };
      setError(res?.response?.data?.message ?? "No se pudo crear técnico.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: Technician) {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      phone: t.phone ?? "",
      email: t.email ?? ""
    });
    setError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      await api.patch(`/technicians/${editingId}`, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined
      });
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      const res = err as { response?: { data?: { message?: string } } };
      setError(res?.response?.data?.message ?? "No se pudo actualizar técnico.");
    }
  }

  async function onDelete(t: Technician) {
    if ((t._count?.devices ?? 0) > 0) {
      window.alert("No se puede eliminar: este técnico tiene equipos asignados. Quitá los equipos de técnico primero.");
      return;
    }
    if (!window.confirm(`¿Eliminar al técnico "${t.name}"?`)) return;
    setDeletingId(t.id);
    try {
      await api.delete(`/technicians/${t.id}`);
      await load();
    } catch (err: unknown) {
      const res = err as { response?: { data?: { message?: string } } };
      window.alert(res?.response?.data?.message ?? "No se pudo eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Técnicos</h2>
      </div>
      <p className="silva-helper" style={{ marginBottom: "1rem" }}>
        Los técnicos son las personas que realizan las reparaciones. Después de crearlos, podés asignarles equipos desde el inventario (En técnico).
      </p>
      {error && (
        <div className="silva-alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <Box className="mb-6">
        <form onSubmit={onCreate} className="silva-form-grid">
          <div className="silva-col-12">
            <span className="silva-badge silva-badge-primary">Nuevo técnico</span>
          </div>
          <div className="silva-col-4">
            <label className="silva-label">Nombre *</label>
            <input
              className="silva-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre del técnico"
            />
          </div>
          <div className="silva-col-4">
            <label className="silva-label">Teléfono</label>
            <input
              className="silva-input"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+54 11 1234-5678"
            />
          </div>
          <div className="silva-col-4">
            <label className="silva-label">Email</label>
            <input
              type="email"
              className="silva-input"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="tecnico@ejemplo.com"
            />
          </div>
          <div className="silva-col-12">
            <button type="submit" className="silva-btn silva-btn-primary" disabled={creating}>
              {creating ? "Creando…" : "Crear técnico"}
            </button>
          </div>
        </form>
      </Box>

      <Box className="p-0 overflow-hidden">
        <h3 style={{ padding: "1rem 1.25rem", margin: 0, fontSize: "1rem" }}>Listado</h3>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Equipos asignados</th>
                <th style={{ width: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id}>
                    <td colSpan={5}>
                      <form onSubmit={onSaveEdit} className="silva-form-grid" style={{ padding: "0.5rem 0", gap: "0.5rem" }}>
                        <div className="silva-col-3">
                          <input
                            className="silva-input"
                            value={editForm.name}
                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Nombre"
                            required
                          />
                        </div>
                        <div className="silva-col-3">
                          <input
                            className="silva-input"
                            value={editForm.phone}
                            onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="Teléfono"
                          />
                        </div>
                        <div className="silva-col-3">
                          <input
                            type="email"
                            className="silva-input"
                            value={editForm.email}
                            onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="Email"
                          />
                        </div>
                        <div className="silva-col-3" style={{ display: "flex", gap: 8 }}>
                          <button type="submit" className="silva-btn silva-btn-primary">
                            Guardar
                          </button>
                          <button type="button" className="silva-btn" onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.phone ?? "—"}</td>
                    <td>{t.email ?? "—"}</td>
                    <td>{t._count?.devices ?? 0}</td>
                    <td>
                      <button type="button" className="silva-btn silva-btn-ghost" onClick={() => startEdit(t)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="silva-btn silva-btn-ghost"
                        style={{ color: "var(--silva-danger)" }}
                        onClick={() => onDelete(t)}
                        disabled={(t._count?.devices ?? 0) > 0 || deletingId === t.id}
                      >
                        {deletingId === t.id ? "…" : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        {technicians.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--silva-muted)" }}>
            No hay técnicos. Creá uno arriba.
          </div>
        )}
      </Box>
    </div>
  );
}
