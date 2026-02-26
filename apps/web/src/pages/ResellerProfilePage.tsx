import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { deviceDisplayLabel } from "../utils/deviceLabel";

type ResellerProfileResponse = {
  reseller: {
    id: string;
    segment?: string | null;
    companyName?: string | null;
    city?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    birthday?: string | null;
    user: { id: string; name: string; email: string };
  };
  summary: {
    debtBalanceCents: number;
    consignmentsCount: number;
    paymentsCount: number;
    debtEntriesCount: number;
  };
  consignments: Array<{
    id: string;
    status: string;
    assignedAt: string;
    closedAt?: string | null;
    device: { id: string; model: string; imei: string; batteryHealth?: number | null; memory?: string | null; color?: string | null };
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    status: "reported_pending" | "confirmed" | "rejected";
    note?: string | null;
    createdAt: string;
    reviewedAt?: string | null;
  }>;
  debtEntries: Array<{
    id: string;
    entryType: "debit" | "credit";
    amountCents: number;
    reason: string;
    createdAt: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }>;
  chat: {
    dmConversationId: string | null;
  };
};

type AvailableDevice = {
  id: string;
  model: string;
  imei: string;
  state: string;
  memory?: string | null;
  color?: string | null;
  costCents?: number | null;
};

type CashBox = { id: string; name: string; currency: string };

function usd(cents: number): string {
  return (cents / 100).toFixed(2);
}

function getDeviceType(model: string): "usado" | "sellado" | "sin_especificar" {
  const m = model.toLowerCase();
  if (m.includes("usado")) return "usado";
  if (m.includes("sellado") || m.includes("sealed") || m.includes("nuevo")) return "sellado";
  return "sin_especificar";
}

function statusBadgeClass(status: string): string {
  if (status === "credit") return "silva-badge silva-badge-success";
  if (status === "debit") return "silva-badge silva-badge-danger";
  if (status === "confirmed" || status === "sold" || status === "sellado") return "silva-badge silva-badge-success";
  if (status === "reported_pending" || status === "active") return "silva-badge silva-badge-warning";
  if (status === "rejected") return "silva-badge silva-badge-danger";
  return "silva-badge silva-badge-primary";
}

export function ResellerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ResellerProfileResponse | null>(null);
  const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [debtSubmitting, setDebtSubmitting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [orderForm, setOrderForm] = useState({
    deviceId: "",
    salePrice: "",
    note: "",
    paymentMethod: "consignacion" as "consignacion" | "usdt" | "transferencia" | "dolar_billete",
    amountPaid: "",
    abonaTotal: false
  });
  const [paymentForm, setPaymentForm] = useState({ amount: "", note: "", cashBoxId: "" });
  const [cashboxes, setCashboxes] = useState<CashBox[]>([]);
  const [debtForm, setDebtForm] = useState({ amount: "", reason: "", entryType: "debit" as "debit" | "credit" });
  const [profileForm, setProfileForm] = useState({
    city: "",
    address: "",
    birthday: "",
    latitude: "",
    longitude: ""
  });

  async function loadProfile(resellerId: string) {
    const res = await api.get(`/resellers/${resellerId}/profile`);
    setData(res.data as ResellerProfileResponse);
  }

  async function loadAvailableDevices() {
    const res = await api.get("/devices");
    const items = (res.data.devices as AvailableDevice[]).filter((d) => d.state === "available");
    setAvailableDevices(items);
  }

  useEffect(() => {
    const resellerId = String(id ?? "");
    if (!resellerId) return;
    setLoading(true);
    setError(null);
    loadProfile(resellerId)
      .catch((err) => {
        const msg = err?.response?.data?.error ?? "No se pudo cargar la ficha del revendedor.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!data) return;
    setProfileForm({
      city: data.reseller.city ?? "",
      address: data.reseller.address ?? "",
      birthday: data.reseller.birthday ? new Date(data.reseller.birthday).toISOString().slice(0, 10) : "",
      latitude: data.reseller.latitude === null || data.reseller.latitude === undefined ? "" : String(data.reseller.latitude),
      longitude: data.reseller.longitude === null || data.reseller.longitude === undefined ? "" : String(data.reseller.longitude)
    });
  }, [data]);

  const recentConsignments = useMemo(() => (data?.consignments ?? []).slice(0, 20), [data]);
  const recentPayments = useMemo(() => (data?.payments ?? []).slice(0, 20), [data]);
  const recentLedger = useMemo(() => (data?.debtEntries ?? []).slice(0, 30), [data]);

  async function openChat() {
    if (!id) return;
    setOpeningChat(true);
    try {
      let conversationId = data?.chat.dmConversationId ?? null;
      if (!conversationId) {
        const res = await api.post(`/chat/dm/by-reseller/${id}`);
        conversationId = res.data.conversationId as string;
      }
      navigate(`/chat?conversationId=${encodeURIComponent(conversationId)}`);
    } catch {
      setError("No se pudo abrir el chat con este revendedor.");
    } finally {
      setOpeningChat(false);
    }
  }

  async function openAddOrderModal() {
    setOrderError(null);
    setOrderForm({ deviceId: "", salePrice: "", note: "", paymentMethod: "consignacion", amountPaid: "", abonaTotal: false });
    await loadAvailableDevices();
    setShowOrderModal(true);
  }

  async function loadCashboxes() {
    try {
      const res = await api.get<{ boxes: CashBox[] }>("/cashboxes");
      setCashboxes(res.data.boxes ?? []);
    } catch {
      setCashboxes([]);
    }
  }

  async function submitOrder(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    if (!orderForm.deviceId) {
      setOrderError("Selecciona un equipo.");
      return;
    }
    const salePriceNum = Number(orderForm.salePrice);
    if (!Number.isFinite(salePriceNum) || salePriceNum < 0) {
      setOrderError("Indicá el valor de venta (USD).");
      return;
    }
    setOrderSubmitting(true);
    setOrderError(null);
    try {
      const salePriceCents = Math.round(salePriceNum * 100);
      const amountPaidCents =
        orderForm.paymentMethod !== "consignacion" && orderForm.amountPaid.trim() !== "" && Number(orderForm.amountPaid) >= 0
          ? Math.round(Number(orderForm.amountPaid) * 100)
          : 0;
      await api.post("/consignments", {
        deviceId: orderForm.deviceId,
        resellerId: data.reseller.id,
        note: orderForm.note.trim() || undefined,
        paymentMethod: orderForm.paymentMethod,
        salePriceCents,
        amountPaidCents
      });
      await loadProfile(data.reseller.id);
      setShowOrderModal(false);
    } catch (err: any) {
      setOrderError(err?.response?.data?.error ?? err?.response?.data?.message ?? "No se pudo agregar el pedido.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  async function submitPayment(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Ingresa un monto valido mayor a 0.");
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      await api.post("/payments/report", {
        resellerId: data.reseller.id,
        amount,
        note: paymentForm.note.trim() || undefined,
        ...(paymentForm.cashBoxId && { cashBoxId: paymentForm.cashBoxId })
      });
      await loadProfile(data.reseller.id);
      setShowPaymentModal(false);
      setPaymentForm({ amount: "", note: "", cashBoxId: "" });
    } catch (err: any) {
      setPaymentError(err?.response?.data?.error ?? err?.response?.data?.message ?? "No se pudo agregar el pago.");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function submitDebt(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const amount = Number(debtForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDebtError("Ingresa un monto valido mayor a 0.");
      return;
    }
    if (!debtForm.reason.trim()) {
      setDebtError("Ingresa el motivo del ajuste.");
      return;
    }
    setDebtSubmitting(true);
    setDebtError(null);
    try {
      await api.post("/debts/entries", {
        resellerId: data.reseller.id,
        entryType: debtForm.entryType,
        amount,
        reason: debtForm.reason.trim()
      });
      await loadProfile(data.reseller.id);
      setShowDebtModal(false);
      setDebtForm({ amount: "", reason: "", entryType: "debit" });
    } catch (err: any) {
      setDebtError(err?.response?.data?.error ?? err?.response?.data?.message ?? "No se pudo agregar la deuda.");
    } finally {
      setDebtSubmitting(false);
    }
  }

  async function saveProfileMeta(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      await api.patch(`/resellers/${data.reseller.id}/profile`, {
        city: profileForm.city.trim() || undefined,
        address: profileForm.address.trim() || undefined,
        birthday: profileForm.birthday ? new Date(profileForm.birthday).toISOString() : null,
        latitude: profileForm.latitude ? Number(profileForm.latitude) : null,
        longitude: profileForm.longitude ? Number(profileForm.longitude) : null
      });
      await loadProfile(data.reseller.id);
    } catch (err: any) {
      setProfileError(err?.response?.data?.message ?? "No se pudo guardar perfil geográfico.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function geocodeFromAddress() {
    if (!data) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      await api.post(`/resellers/${data.reseller.id}/geocode`);
      await loadProfile(data.reseller.id);
    } catch (err: any) {
      setProfileError(err?.response?.data?.message ?? "No se pudo geocodificar.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function deleteReseller() {
    if (!data) return;
    if (!window.confirm(`¿Eliminar al revendedor "${data.reseller.user.name}"? Se borrarán consignaciones, movimientos de deuda y pagos. El usuario no podrá volver a entrar.`)) return;
    setDeleteConfirming(true);
    try {
      await api.delete(`/resellers/${data.reseller.id}`);
      navigate("/resellers");
    } catch (err: any) {
      window.alert(err?.response?.data?.error ?? "No se pudo eliminar el revendedor.");
    } finally {
      setDeleteConfirming(false);
    }
  }

  if (loading) {
    return (
      <Box>
        <p className="silva-helper">Cargando ficha del revendedor...</p>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <p className="silva-alert">{error}</p>
        <Link to="/resellers" className="silva-btn">
          Volver a revendedores
        </Link>
      </Box>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Planilla de revendedor</h2>
        <p className="silva-page-subtitle">Historial operativo, deuda y acceso a chat.</p>
      </div>

      <div className="silva-kpi-grid" style={{ marginBottom: "14px" }}>
        <div className="silva-kpi-card">
          <div className="silva-kpi-label">Revendedor</div>
          <div className="silva-kpi-value" style={{ fontSize: "1.1rem" }}>{data.reseller.user.name}</div>
          <div className="silva-helper">{data.reseller.user.email}</div>
        </div>
        <div className="silva-kpi-card">
          <div className="silva-kpi-label">Deuda actual (USD)</div>
          <div className="silva-kpi-value">{usd(data.summary.debtBalanceCents)}</div>
        </div>
        <div className="silva-kpi-card">
          <div className="silva-kpi-label">Consignaciones</div>
          <div className="silva-kpi-value">{data.summary.consignmentsCount}</div>
        </div>
        <div className="silva-kpi-card">
          <div className="silva-kpi-label">Pagos reportados</div>
          <div className="silva-kpi-value">{data.summary.paymentsCount}</div>
        </div>
      </div>

      <Box className="mb-6">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="silva-btn silva-btn-primary" onClick={openChat} disabled={openingChat}>
            {openingChat ? "Abriendo chat..." : "Abrir chat con revendedor"}
          </button>
          <Link to="/resellers" className="silva-btn">
            Volver a revendedores
          </Link>
          <button
            type="button"
            className="silva-btn"
            style={{ marginLeft: "auto", color: "var(--silva-danger, #c00)", borderColor: "var(--silva-danger, #c00)" }}
            onClick={deleteReseller}
            disabled={deleteConfirming}
            title="Eliminar revendedor"
          >
            {deleteConfirming ? "Eliminando..." : "Eliminar revendedor"}
          </button>
        </div>
      </Box>

      <Box className="mb-6">
        <h3 className="silva-page-title" style={{ fontSize: "0.95rem" }}>Ubicación y cumpleaños</h3>
        <form className="silva-form-grid" onSubmit={saveProfileMeta}>
          <div className="silva-col-3">
            <label className="silva-label">Ciudad</label>
            <input className="silva-input" value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} />
          </div>
          <div className="silva-col-3">
            <label className="silva-label">Dirección</label>
            <input className="silva-input" value={profileForm.address} onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Cumpleaños</label>
            <input type="date" className="silva-input" value={profileForm.birthday} onChange={(e) => setProfileForm((p) => ({ ...p, birthday: e.target.value }))} />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Latitud</label>
            <input className="silva-input" value={profileForm.latitude} onChange={(e) => setProfileForm((p) => ({ ...p, latitude: e.target.value }))} />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Longitud</label>
            <input className="silva-input" value={profileForm.longitude} onChange={(e) => setProfileForm((p) => ({ ...p, longitude: e.target.value }))} />
          </div>
          {profileError && <div className="silva-col-12 silva-alert">{profileError}</div>}
          <div className="silva-col-12" style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="silva-btn silva-btn-primary" disabled={profileSaving}>
              {profileSaving ? "Guardando..." : "Guardar ubicación"}
            </button>
            <button type="button" className="silva-btn" onClick={geocodeFromAddress} disabled={profileSaving}>
              Geocodificar desde dirección
            </button>
          </div>
        </form>
      </Box>

      <Box className="mb-6 p-0 overflow-hidden">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px 0" }}>
          <h3 className="silva-page-title" style={{ fontSize: "0.95rem", margin: 0 }}>Ultimos pedidos</h3>
          <button type="button" className="silva-btn silva-btn-primary" onClick={openAddOrderModal}>
            + Agregar pedido
          </button>
        </div>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Ultimos pedidos / consignaciones</th>
                <th>Tipo</th>
                <th>IMEI</th>
                <th>Estado</th>
                <th>Bateria</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentConsignments.map((c) => {
                const t = getDeviceType(c.device.model);
                return (
                  <tr key={c.id}>
                    <td>{deviceDisplayLabel(c.device)}</td>
                    <td>
                      <span className={statusBadgeClass(t)}>
                        {t === "sin_especificar" ? "sin especificar" : t}
                      </span>
                    </td>
                    <td>{c.device.imei}</td>
                    <td>
                      <span className={statusBadgeClass(c.status)}>{c.status}</span>
                    </td>
                    <td>{c.device.batteryHealth ?? "-"}</td>
                    <td>{new Date(c.assignedAt).toLocaleString()}</td>
                  </tr>
                );
              })}
              {recentConsignments.length === 0 && (
                <tr>
                  <td colSpan={6}>Sin consignaciones registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Box>

      <Box className="mb-6 p-0 overflow-hidden">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px 0" }}>
          <h3 className="silva-page-title" style={{ fontSize: "0.95rem", margin: 0 }}>Pagos</h3>
          <button
            type="button"
            className="silva-btn silva-btn-primary"
            onClick={async () => {
              setPaymentError(null);
              setPaymentForm({ amount: "", note: "", cashBoxId: "" });
              await loadCashboxes();
              setShowPaymentModal(true);
            }}
          >
            + Agregar pago
          </button>
        </div>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Historial de pagos</th>
                <th>Monto (USD)</th>
                <th>Estado</th>
                <th>Nota</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id}>
                  <td>{p.id.slice(0, 8)}</td>
                  <td>{usd(p.amountCents)}</td>
                  <td>
                    <span className={statusBadgeClass(p.status)}>{p.status}</span>
                  </td>
                  <td>{p.note ?? "-"}</td>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan={5}>Sin pagos reportados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Box>

      <Box className="p-0 overflow-hidden">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px 0" }}>
          <h3 className="silva-page-title" style={{ fontSize: "0.95rem", margin: 0 }}>Deudas</h3>
          <button
            type="button"
            className="silva-btn silva-btn-primary"
            onClick={() => {
              setDebtError(null);
              setDebtForm({ amount: "", reason: "", entryType: "debit" });
              setShowDebtModal(true);
            }}
          >
            + Agregar deuda
          </button>
        </div>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Historial de deuda</th>
                <th>Tipo</th>
                <th>Monto (USD)</th>
                <th>Motivo</th>
                <th>Referencia</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentLedger.map((e) => (
                <tr key={e.id}>
                  <td>{e.id.slice(0, 8)}</td>
                  <td>
                    <span className={statusBadgeClass(e.entryType)}>{e.entryType}</span>
                  </td>
                  <td>{usd(e.amountCents)}</td>
                  <td>{e.reason}</td>
                  <td>{e.referenceType ?? "-"} {e.referenceId ? `(${e.referenceId.slice(0, 8)})` : ""}</td>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {recentLedger.length === 0 && (
                <tr>
                  <td colSpan={6}>Sin movimientos de deuda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Box>

      {showOrderModal && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
          <div className="silva-modal">
            <h3 id="order-modal-title" className="silva-modal-title">Agregar pedido</h3>
            <p className="silva-modal-subtitle">Asigna equipo al revendedor. Indicá valor de venta y cuánto paga ahora para que la deuda sea correcta.</p>
            <form onSubmit={submitOrder}>
              <label className="silva-label">Equipo disponible</label>
              <select
                className="silva-select"
                value={orderForm.deviceId}
                onChange={(e) => setOrderForm((p) => ({ ...p, deviceId: e.target.value }))}
              >
                <option value="">Seleccionar</option>
                {availableDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {deviceDisplayLabel(d)} - {d.imei}
                    {d.costCents != null ? ` (costo ${(d.costCents / 100).toFixed(2)} USD)` : ""}
                  </option>
                ))}
              </select>
              <label className="silva-label" style={{ marginTop: "10px" }}>Valor de venta (USD)</label>
              <input
                className="silva-input"
                type="number"
                step="0.01"
                min="0"
                value={orderForm.salePrice}
                onChange={(e) => {
                  const v = e.target.value;
                  setOrderForm((p) => ({
                    ...p,
                    salePrice: v,
                    ...(p.abonaTotal ? { amountPaid: v } : {})
                  }));
                }}
                placeholder="Ej. 850"
                required
              />
              <p className="silva-helper" style={{ marginTop: 4 }}>Precio al que le vendés este equipo al revendedor. La deuda será: valor de venta − lo que paga ahora.</p>
              <label className="silva-label" style={{ marginTop: "10px" }}>¿Cómo paga?</label>
              <select
                className="silva-select"
                value={orderForm.paymentMethod}
                onChange={(e) => setOrderForm((p) => ({ ...p, paymentMethod: e.target.value as typeof orderForm.paymentMethod }))}
              >
                <option value="consignacion">Consignación (no paga ahora)</option>
                <option value="usdt">USDT</option>
                <option value="transferencia">Transferencia</option>
                <option value="dolar_billete">Dólar billete</option>
              </select>
              {orderForm.paymentMethod !== "consignacion" && (
                <>
                  <label className="silva-label" style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={orderForm.abonaTotal}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOrderForm((p) => ({
                          ...p,
                          abonaTotal: checked,
                          amountPaid: checked ? p.salePrice : p.amountPaid
                        }));
                      }}
                    />
                    Abona el total
                  </label>
                  <label className="silva-label" style={{ marginTop: "6px" }}>Monto que paga ahora (USD)</label>
                  <input
                    className="silva-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderForm.amountPaid}
                    onChange={(e) => setOrderForm((p) => ({ ...p, amountPaid: e.target.value }))}
                    placeholder={orderForm.abonaTotal ? orderForm.salePrice || "0" : "Ej. 400"}
                  />
                  <p className="silva-helper" style={{ marginTop: 4 }}>Si paga menos que el valor de venta, el saldo queda como deuda.</p>
                </>
              )}
              <label className="silva-label" style={{ marginTop: "10px" }}>Nota</label>
              <input
                className="silva-input"
                value={orderForm.note}
                onChange={(e) => setOrderForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Opcional"
              />
              {orderError && <p className="silva-alert" role="alert">{orderError}</p>}
              <div className="silva-modal-actions">
                <button type="button" className="silva-btn" onClick={() => setShowOrderModal(false)} disabled={orderSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="silva-btn silva-btn-primary" disabled={orderSubmitting}>
                  {orderSubmitting ? "Guardando..." : "Guardar pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
          <div className="silva-modal">
            <h3 id="payment-modal-title" className="silva-modal-title">Agregar pago</h3>
            <p className="silva-modal-subtitle">Registra un pago para este revendedor. Indicá a qué caja se acredita (al confirmar se generará el movimiento).</p>
            <form onSubmit={submitPayment}>
              <label className="silva-label">Monto (USD)</label>
              <input
                className="silva-input"
                type="number"
                step="0.01"
                min="0"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
              />
              <label className="silva-label" style={{ marginTop: "10px" }}>Acreditar a caja</label>
              <select
                className="silva-select"
                value={paymentForm.cashBoxId}
                onChange={(e) => setPaymentForm((p) => ({ ...p, cashBoxId: e.target.value }))}
              >
                <option value="">Sin asignar</option>
                {cashboxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name} ({box.currency})
                  </option>
                ))}
              </select>
              <label className="silva-label" style={{ marginTop: "10px" }}>Nota</label>
              <input
                className="silva-input"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Opcional"
              />
              {paymentError && <p className="silva-alert" role="alert">{paymentError}</p>}
              <div className="silva-modal-actions">
                <button type="button" className="silva-btn" onClick={() => setShowPaymentModal(false)} disabled={paymentSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="silva-btn silva-btn-primary" disabled={paymentSubmitting}>
                  {paymentSubmitting ? "Guardando..." : "Guardar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDebtModal && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="debt-modal-title">
          <div className="silva-modal">
            <h3 id="debt-modal-title" className="silva-modal-title">Agregar deuda</h3>
            <p className="silva-modal-subtitle">Registra un ajuste manual de deuda o credito.</p>
            <form onSubmit={submitDebt}>
              <label className="silva-label">Tipo de ajuste</label>
              <select
                className="silva-select"
                value={debtForm.entryType}
                onChange={(e) => setDebtForm((p) => ({ ...p, entryType: e.target.value as "debit" | "credit" }))}
              >
                <option value="debit">Debito (aumenta deuda)</option>
                <option value="credit">Credito (disminuye deuda)</option>
              </select>
              <label className="silva-label" style={{ marginTop: "10px" }}>Monto (USD)</label>
              <input
                className="silva-input"
                type="number"
                step="0.01"
                min="0"
                value={debtForm.amount}
                onChange={(e) => setDebtForm((p) => ({ ...p, amount: e.target.value }))}
              />
              <label className="silva-label" style={{ marginTop: "10px" }}>Motivo</label>
              <input
                className="silva-input"
                value={debtForm.reason}
                onChange={(e) => setDebtForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Ej: ajuste por diferencia de caja"
              />
              {debtError && <p className="silva-alert" role="alert">{debtError}</p>}
              <div className="silva-modal-actions">
                <button type="button" className="silva-btn" onClick={() => setShowDebtModal(false)} disabled={debtSubmitting}>
                  Cancelar
                </button>
                <button type="submit" className="silva-btn silva-btn-primary" disabled={debtSubmitting}>
                  {debtSubmitting ? "Guardando..." : "Guardar deuda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

