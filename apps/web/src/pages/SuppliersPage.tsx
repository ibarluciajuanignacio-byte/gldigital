import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { Building2 } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  cuit?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  currency: string;
  _count?: { purchaseOrders: number };
};

export function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    name: "",
    cuit: "",
    phone: "",
    email: "",
    address: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateModalMessage, setDuplicateModalMessage] = useState("");

  async function load() {
    try {
      const { data } = await api.get<{ suppliers: Supplier[] }>("/suppliers", {
        params: q ? { q } : undefined
      });
      setSuppliers(data.suppliers ?? []);
    } catch {
      setError("No se pudo cargar proveedores.");
    }
  }

  useEffect(() => {
    void load();
  }, [q]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Razón social es obligatoria.");
      return;
    }
    setCreating(true);
    setError(null);
    setDuplicateModalOpen(false);
    try {
      await api.post("/suppliers", {
        name: form.name.trim(),
        cuit: form.cuit.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined
      });
      setForm({ name: "", cuit: "", phone: "", email: "", address: "" });
      await load();
    } catch (err: unknown) {
      const res = err as { response?: { data?: { message?: string; code?: string } } };
      const msg = res?.response?.data?.message ?? "No se pudo crear proveedor.";
      const isDuplicate = res?.response?.data?.code === "DUPLICATE_SUPPLIER_NAME" || (typeof msg === "string" && msg.includes("Ya existe un proveedor"));
      if (isDuplicate) {
        setDuplicateModalMessage(msg);
        setDuplicateModalOpen(true);
      } else {
        setError(msg);
      }
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(supplier: Supplier, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const orderCount = supplier._count?.purchaseOrders ?? 0;
    if (orderCount > 0) {
      window.alert("No se puede eliminar: este proveedor tiene órdenes de compra. Eliminá o reasigná las órdenes primero.");
      return;
    }
    if (!window.confirm(`¿Eliminar al proveedor "${supplier.name}"?`)) return;
    setDeletingId(supplier.id);
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      await load();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
      window.alert(res?.data?.error ?? "No se pudo eliminar el proveedor.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Proveedores</h2>
      </div>
      {error && (
        <div className="silva-alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <Box className="mb-6">
        <form onSubmit={onCreate} className="silva-form-grid">
          <div className="silva-col-12">
            <span className="silva-badge silva-badge-primary">Nuevo proveedor</span>
          </div>
          <div className="silva-col-4">
            <label className="silva-label">Razón social *</label>
            <input
              className="silva-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre del taller o empresa"
            />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">CUIT</label>
            <input
              className="silva-input"
              value={form.cuit}
              onChange={(e) => setForm((p) => ({ ...p, cuit: e.target.value }))}
              placeholder="20-12345678-9"
            />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Teléfono</label>
            <input
              className="silva-input"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+54 11 1234-5678"
            />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Email</label>
            <input
              type="email"
              className="silva-input"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="contacto@ejemplo.com"
            />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Dirección</label>
            <input
              className="silva-input"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Calle, número, ciudad"
            />
          </div>
          <div className="silva-col-12">
            <button type="submit" className="silva-btn silva-btn-primary" disabled={creating}>
              Registrar proveedor
            </button>
          </div>
        </form>
      </Box>

      <div className="silva-form-grid" style={{ marginBottom: "1rem" }}>
        <div className="silva-col-12">
          <label className="silva-label">Buscar</label>
          <input
            className="silva-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Razón social, CUIT o email..."
          />
        </div>
      </div>

      <Box className="p-0 overflow-hidden">
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>CUIT</th>
                <th>Contacto</th>
                <th>Órdenes</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/suppliers/${s.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/suppliers/${s.id}`)}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                >
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                      <Building2 size={16} style={{ color: "var(--silva-primary)" }} />
                      <strong>{s.name}</strong>
                    </span>
                  </td>
                  <td>{s.cuit ?? "—"}</td>
                  <td>{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td>
                    <span className="silva-badge silva-badge-primary">{s._count?.purchaseOrders ?? 0}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="silva-btn"
                      style={{ fontSize: "0.85rem", padding: "4px 8px" }}
                      onClick={(e) => onDelete(s, e)}
                      disabled={deletingId === s.id || (s._count?.purchaseOrders ?? 0) > 0}
                      title={(s._count?.purchaseOrders ?? 0) > 0 ? "No se puede eliminar: tiene órdenes" : "Eliminar proveedor"}
                    >
                      {deletingId === s.id ? "..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {suppliers.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--silva-muted)" }}>
            No hay proveedores. Creá uno arriba.
          </div>
        )}
      </Box>

      {duplicateModalOpen && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="duplicate-supplier-modal-title">
          <div className="silva-modal">
            <h3 id="duplicate-supplier-modal-title" className="silva-modal-title">Nombre duplicado</h3>
            <p className="silva-modal-subtitle" style={{ marginTop: 8 }}>{duplicateModalMessage}</p>
            <div className="silva-modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="silva-btn silva-btn-primary"
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setDuplicateModalMessage("");
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
