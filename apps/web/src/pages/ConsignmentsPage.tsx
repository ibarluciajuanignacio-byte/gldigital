import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";
import { deviceDisplayLabel } from "../utils/deviceLabel";

type Consignment = {
  id: string;
  status: string;
  resellerId: string;
  device: { model: string; imei: string; memory?: string | null; color?: string | null };
  reseller: { user: { name: string } };
};

type Device = { id: string; model: string; imei: string; state: string; memory?: string | null; color?: string | null };
type Reseller = { id: string; user: { name: string } };

export function ConsignmentsPage() {
  const { user } = useAuth();
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [form, setForm] = useState({ deviceId: "", resellerId: "" });
  const [sellModal, setSellModal] = useState<{ consignmentId: string; deviceModel: string } | null>(null);
  const [sellAmountUsd, setSellAmountUsd] = useState("");
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const [cRes, dRes] = await Promise.all([api.get("/consignments"), api.get("/devices")]);
      setConsignments(cRes.data.consignments ?? []);
      setDevices(dRes.data.devices ?? []);
      if (user?.role === "admin") {
        const rRes = await api.get("/resellers");
        setResellers(rRes.data.resellers ?? []);
      }
    } catch {
      setLoadError("No se pudo cargar consignaciones o equipos.");
      setConsignments([]);
      setDevices([]);
      if (user?.role === "admin") setResellers([]);
    }
  }

  useEffect(() => {
    load();
  }, [user?.role]);

  async function assign(e: FormEvent) {
    e.preventDefault();
    setAssignError(null);
    try {
      await api.post("/consignments", form);
      setForm({ deviceId: "", resellerId: "" });
      await load();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { message?: string } } }).response : undefined;
      setAssignError(res?.data?.message ?? "No se pudo asignar el equipo al revendedor.");
    }
  }

  function openSellModal(consignmentId: string, deviceModel: string) {
    setSellModal({ consignmentId, deviceModel });
    setSellAmountUsd("");
    setSellError(null);
  }

  function closeSellModal() {
    setSellModal(null);
    setSellAmountUsd("");
    setSellError(null);
  }

  async function confirmMarkSold(e: FormEvent) {
    e.preventDefault();
    if (!sellModal) return;
    const amount = parseFloat(sellAmountUsd.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) {
      setSellError("Ingresá un monto válido en USD (ej. 800)");
      return;
    }
    setSellSubmitting(true);
    setSellError(null);
    try {
      await api.post(`/consignments/${sellModal.consignmentId}/sold`, {
        saleAmountCents: Math.round(amount * 100)
      });
      closeSellModal();
      await load();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { message?: string } } }).response : undefined;
      setSellError(res?.data?.message ?? "Error al registrar la venta.");
    } finally {
      setSellSubmitting(false);
    }
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Consignaciones</h2>
      </div>
      {loadError && (
        <div className="silva-alert" style={{ marginBottom: 12 }} role="alert">{loadError}</div>
      )}
      {user?.role === "admin" && (
        <Box className="mb-6">
          {assignError && (
            <div className="silva-alert" style={{ marginBottom: 12 }} role="alert">{assignError}</div>
          )}
          <form onSubmit={assign} className="silva-form-grid">
            <div className="silva-col-4">
              <label className="silva-label">Equipo</label>
              <select
                className="silva-select"
                value={form.deviceId}
                onChange={(e) => setForm((p) => ({ ...p, deviceId: e.target.value }))}
              >
                <option value="">Seleccionar</option>
                {devices
                  .filter((d) => d.state === "available")
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {deviceDisplayLabel(d)} - {d.imei}
                    </option>
                  ))}
              </select>
            </div>
            <div className="silva-col-4">
              <label className="silva-label">Revendedor</label>
              <select
                className="silva-select"
                value={form.resellerId}
                onChange={(e) => setForm((p) => ({ ...p, resellerId: e.target.value }))}
              >
                <option value="">Seleccionar</option>
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="silva-col-12" style={{ display: "flex", alignItems: "end" }}>
              <button type="submit" className="silva-btn silva-btn-primary">
                Asignar consignación
              </button>
            </div>
          </form>
        </Box>
      )}

      <Box className="p-0 overflow-hidden">
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Revendedor</th>
                <th>Estado</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {consignments.map((item) => (
                <tr key={item.id}>
                  <td>{deviceDisplayLabel(item.device)}</td>
                  <td>{item.reseller.user.name}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.status !== "sold" && (
                      <button
                        type="button"
                        className="silva-btn"
                        onClick={() => openSellModal(item.id, deviceDisplayLabel(item.device))}
                      >
                        Marcar vendido
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {/* Modal: ingresar monto de venta al marcar vendido */}
      {sellModal && (
        <div
          className="silva-modal-backdrop"
          role="dialog"
          aria-labelledby="sell-modal-title"
          aria-modal="true"
        >
          <div className="silva-modal">
            <h3 id="sell-modal-title" className="silva-modal-title">Marcar como vendido</h3>
            <p className="silva-modal-subtitle">{sellModal.deviceModel}</p>
            <form onSubmit={confirmMarkSold}>
              <label className="silva-label">Monto de venta (USD)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="ej. 800"
                className="silva-input"
                value={sellAmountUsd}
                onChange={(e) => setSellAmountUsd(e.target.value)}
                disabled={sellSubmitting}
                autoFocus
              />
              {sellError && (
                <p className="silva-alert" role="alert">{sellError}</p>
              )}
              <div className="silva-modal-actions">
                <button
                  type="button"
                  onClick={closeSellModal}
                  className="silva-btn"
                  disabled={sellSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sellSubmitting}
                  className="silva-btn silva-btn-primary"
                >
                  {sellSubmitting ? "Guardando…" : "Confirmar venta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
