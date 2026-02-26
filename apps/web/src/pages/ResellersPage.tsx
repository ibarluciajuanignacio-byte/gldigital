import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";

type Reseller = {
  id: string;
  segment?: string;
  companyName?: string;
  city?: string;
  address?: string;
  birthday?: string;
  latitude?: number;
  longitude?: number;
  debtBalanceCents?: number;
  consignmentsCount?: number;
  user: { name: string; email: string };
};

export function ResellersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "revendedor123",
    segment: "",
    companyName: "",
    city: "",
    address: "",
    birthday: ""
  });

  async function load() {
    if (user?.role !== "admin") return;
    setLoadError(null);
    try {
      const { data } = await api.get("/resellers");
      setResellers(data.resellers ?? []);
    } catch {
      setLoadError("No se pudo cargar la lista de revendedores.");
      setResellers([]);
    }
  }

  useEffect(() => {
    load();
  }, [user?.role]);

  if (user?.role !== "admin") {
    return (
      <Box>
        <p className="silva-helper">Solo el administrador puede ver este módulo.</p>
      </Box>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await api.post("/resellers", {
        ...form,
        birthday: form.birthday ? new Date(form.birthday).toISOString() : undefined
      });
      setForm({ name: "", email: "", password: "revendedor123", segment: "", companyName: "", city: "", address: "", birthday: "" });
      setCreateModalOpen(false);
      await load();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { message?: string } } }).response : undefined;
      setCreateError(res?.data?.message ?? "No se pudo crear el revendedor.");
    }
  }

  async function onDelete(reseller: Reseller, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar al revendedor "${reseller.user.name}"? Se borrarán sus consignaciones, movimientos de deuda y pagos. El usuario no podrá volver a entrar.`)) return;
    setDeletingId(reseller.id);
    try {
      await api.delete(`/resellers/${reseller.id}`);
      await load();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
      window.alert(res?.data?.error ?? "No se pudo eliminar el revendedor.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Revendedores</h2>
      </div>
      {loadError && (
        <div className="silva-alert" style={{ marginBottom: 12 }} role="alert">
          {loadError}
        </div>
      )}
      <Box className="p-0 overflow-hidden">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="silva-btn"
            onClick={() => navigate("/resellers/map")}
          >
            Ver mapa de revendedores
          </button>
          <button
            type="button"
            className="silva-btn silva-btn-primary"
            onClick={() => {
              setCreateError(null);
              setCreateModalOpen(true);
            }}
          >
            + Revendedor
          </button>
        </div>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Deuda (USD)</th>
                <th>En consignación</th>
                <th>Segmento</th>
                <th>Empresa</th>
                <th>Ciudad</th>
                <th>Cumpleaños</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resellers.map((reseller) => (
                <tr
                  key={reseller.id}
                  onClick={() => navigate(`/resellers/${reseller.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/resellers/${reseller.id}`)}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                >
                  <td style={{ color: "var(--silva-primary)", fontWeight: 600 }}>{reseller.user.name}</td>
                  <td>{((reseller.debtBalanceCents ?? 0) / 100).toFixed(2)}</td>
                  <td>{reseller.consignmentsCount ?? 0}</td>
                  <td>{reseller.segment ?? "-"}</td>
                  <td>{reseller.companyName ?? "-"}</td>
                  <td>{reseller.city ?? "-"}</td>
                  <td>{reseller.birthday ? new Date(reseller.birthday).toLocaleDateString() : "-"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="silva-btn"
                      style={{ fontSize: "0.85rem", padding: "4px 8px" }}
                      onClick={(e) => onDelete(reseller, e)}
                      disabled={deletingId === reseller.id}
                      title="Eliminar revendedor"
                    >
                      {deletingId === reseller.id ? "..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {createModalOpen && (
        <div
          className="silva-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-reseller-modal-title"
        >
          <div className="silva-modal">
            <h3 id="create-reseller-modal-title" className="silva-modal-title">Crear revendedor</h3>
            <form onSubmit={onCreate} className="silva-form-grid" style={{ marginTop: 12 }}>
              <div className="silva-col-12">
                <label className="silva-label">Nombre</label>
                <input
                  className="silva-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Email</label>
                <input
                  className="silva-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Contraseña</label>
                <input
                  className="silva-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Segmento</label>
                <input
                  className="silva-input"
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Empresa</label>
                <input
                  className="silva-input"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Ciudad</label>
                <input
                  className="silva-input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Dirección</label>
                <input
                  className="silva-input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="silva-col-12">
                <label className="silva-label">Cumpleaños</label>
                <input
                  className="silva-input"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              {createError && (
                <p className="silva-alert" role="alert" style={{ gridColumn: "1 / -1" }}>{createError}</p>
              )}
              <div className="silva-modal-actions" style={{ gridColumn: "1 / -1", marginTop: 14 }}>
                <button
                  type="button"
                  className="silva-btn"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateError(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="silva-btn silva-btn-primary">
                  Crear revendedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
