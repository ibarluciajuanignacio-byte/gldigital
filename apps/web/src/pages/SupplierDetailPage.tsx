import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { Building2 } from "lucide-react";

type PurchaseOrder = {
  id: string;
  orderNumber: string | null;
  currency: string;
  totalAmountCents: number | null;
  statusPayment: string;
  statusPhysical: string;
  createdAt: string;
};

type SupplierData = {
  id: string;
  name: string;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  notes: string | null;
  purchaseOrders: PurchaseOrder[];
};

function formatCents(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cuit: "",
    phone: "",
    email: "",
    address: "",
    currency: "USD" as "USD" | "ARS",
    notes: ""
  });

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ supplier: SupplierData }>(`/suppliers/${id}`);
      setSupplier(data.supplier);
      setForm({
        name: data.supplier.name,
        cuit: data.supplier.cuit ?? "",
        phone: data.supplier.phone ?? "",
        email: data.supplier.email ?? "",
        address: data.supplier.address ?? "",
        currency: (data.supplier.currency as "USD" | "ARS") || "USD",
        notes: data.supplier.notes ?? ""
      });
    } catch {
      setError("No se pudo cargar la ficha del proveedor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/suppliers/${supplier.id}`, {
        name: form.name.trim() || undefined,
        cuit: form.cuit.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        currency: form.currency,
        notes: form.notes.trim() || null
      });
      await load();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { message?: string } } }).response : undefined;
      setSaveError(res?.data?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!supplier) return;
    if (supplier.purchaseOrders.length > 0) {
      window.alert("No se puede eliminar: tiene órdenes de compra asociadas.");
      return;
    }
    if (!window.confirm(`¿Eliminar al proveedor "${supplier.name}"?`)) return;
    setDeleteConfirming(true);
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      navigate("/suppliers");
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
      window.alert(res?.data?.error ?? "No se pudo eliminar el proveedor.");
    } finally {
      setDeleteConfirming(false);
    }
  }

  if (loading) {
    return (
      <Box>
        <p className="silva-helper">Cargando ficha del proveedor...</p>
      </Box>
    );
  }

  if (error || !supplier) {
    return (
      <Box>
        <p className="silva-alert">{error ?? "Proveedor no encontrado"}</p>
        <Link to="/suppliers" className="silva-btn">
          Volver a proveedores
        </Link>
      </Box>
    );
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Ficha de proveedor</h2>
        <p className="silva-page-subtitle">Datos de contacto, anotaciones y órdenes de compra.</p>
      </div>

      <div className="silva-kpi-grid" style={{ marginBottom: "14px" }}>
        <div className="silva-kpi-card">
          <div className="silva-kpi-label">Proveedor</div>
          <div className="silva-kpi-value" style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={20} style={{ color: "var(--silva-primary)" }} />
            {supplier.name}
          </div>
          <div className="silva-helper">{supplier.purchaseOrders.length} órdenes de compra</div>
        </div>
      </div>

      <Box className="mb-6">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Link to="/suppliers" className="silva-btn">
            Volver a proveedores
          </Link>
          <button
            type="button"
            className="silva-btn"
            style={{ color: "var(--silva-danger, #c00)", borderColor: "var(--silva-danger, #c00)" }}
            onClick={onDelete}
            disabled={deleteConfirming || supplier.purchaseOrders.length > 0}
            title={supplier.purchaseOrders.length > 0 ? "No se puede eliminar: tiene órdenes" : "Eliminar proveedor"}
          >
            {deleteConfirming ? "Eliminando..." : "Eliminar proveedor"}
          </button>
        </div>
      </Box>

      <Box className="mb-6">
        <h3 className="silva-page-title" style={{ fontSize: "0.95rem", marginBottom: 12 }}>Datos del proveedor</h3>
        <form onSubmit={onSave} className="silva-form-grid">
          <div className="silva-col-4">
            <label className="silva-label">Razón social *</label>
            <input
              className="silva-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre del taller o empresa"
              required
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
            <label className="silva-label">Moneda</label>
            <select
              className="silva-select"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value as "USD" | "ARS" }))}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
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
          <div className="silva-col-12">
            <label className="silva-label">Dirección</label>
            <input
              className="silva-input"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Calle, número, ciudad"
            />
          </div>
          <div className="silva-col-12">
            <label className="silva-label">Anotaciones</label>
            <textarea
              className="silva-input"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notas internas sobre el proveedor, condiciones, contactos adicionales..."
              rows={4}
              style={{ resize: "vertical", minHeight: 80 }}
            />
          </div>
          {saveError && (
            <div className="silva-col-12 silva-alert" role="alert">{saveError}</div>
          )}
          <div className="silva-col-12">
            <button type="submit" className="silva-btn silva-btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Box>

      <Box className="p-0 overflow-hidden">
        <div style={{ padding: "12px 12px 0" }}>
          <h3 className="silva-page-title" style={{ fontSize: "0.95rem", margin: 0 }}>Órdenes de compra</h3>
          <p className="silva-helper" style={{ marginTop: 4 }}>Últimas 50 órdenes. Clic en una fila para ver el detalle.</p>
        </div>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Nº orden</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Recepción</th>
              </tr>
            </thead>
            <tbody>
              {supplier.purchaseOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/purchases/${order.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/purchases/${order.id}`)}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                >
                  <td style={{ color: "var(--silva-primary)", fontWeight: 600 }}>
                    {order.orderNumber ?? order.id.slice(0, 8)}
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{formatCents(order.totalAmountCents, order.currency)}</td>
                  <td>
                    <span className={`silva-badge silva-badge-${order.statusPayment === "paid" ? "success" : order.statusPayment === "partial" ? "warning" : "primary"}`}>
                      {order.statusPayment}
                    </span>
                  </td>
                  <td>
                    <span className={`silva-badge silva-badge-${order.statusPhysical === "received" ? "success" : order.statusPhysical === "partial" ? "warning" : "primary"}`}>
                      {order.statusPhysical}
                    </span>
                  </td>
                </tr>
              ))}
              {supplier.purchaseOrders.length === 0 && (
                <tr>
                  <td colSpan={5}>Sin órdenes de compra. Creá una desde Compras.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}
