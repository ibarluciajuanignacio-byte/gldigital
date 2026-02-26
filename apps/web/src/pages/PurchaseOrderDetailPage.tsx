import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { ImeiBarcodeScannerModal } from "../components/ImeiBarcodeScannerModal";
import { isMobile } from "../utils/isMobile";
import { ArrowLeft, Barcode, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { getBaseModels, getVersionOptions, getModelForVersionKey } from "../utils/phoneCatalogGroup";

type PurchaseOrderItem = {
  id: string;
  modelLabel: string;
  model?: string | null;
  displayModel?: string | null;
  memory?: string | null;
  color?: string | null;
  quantityExpected: number;
  quantityReceived: number;
  unitCostCents?: number | null;
  devices?: { id: string; imei: string }[];
};
type Order = {
  id: string;
  orderNumber: string | null;
  currency: string;
  totalAmountCents?: number | null;
  statusPayment: string;
  statusPhysical: string;
  shippingCostCents?: number;
  supplier: { id: string; name: string };
  items: PurchaseOrderItem[];
  createdAt: string;
};

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [phoneCatalog, setPhoneCatalog] = useState<Array<{ model: string; label: string; colors: string[]; storages: string[] }>>([]);
  const [formItem, setFormItem] = useState({
    baseModel: "",
    versionKey: "" as "" | "Plus" | "Pro" | "Pro Max",
    memory: "",
    color: "",
    quantityExpected: "1",
    unitCostCents: ""
  });
  const formItemModel = formItem.baseModel
    ? getModelForVersionKey(phoneCatalog, formItem.baseModel, formItem.versionKey)
    : "";
  const [formReceive, setFormReceive] = useState({
    purchaseOrderItemId: "",
    imei: "",
    condition: "sealed" as "sealed" | "used"
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [imeiScannerOpen, setImeiScannerOpen] = useState(false);
  const [editItem, setEditItem] = useState<PurchaseOrderItem | null>(null);
  const [editForm, setEditForm] = useState({ quantityExpected: "", unitCostCents: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      const { data } = await api.get<{ order: Order }>(`/purchases/${id}`);
      setOrder(data.order);
    } catch {
      setError("No se pudo cargar la orden.");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    api.get<{ catalog: Array<{ model: string; label: string; colors: string[]; storages: string[] }> }>("/catalog/phone-models").then(
      (r) => setPhoneCatalog(r.data.catalog ?? []),
      () => setPhoneCatalog([])
    );
  }, []);

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    const model = formItem.baseModel ? getModelForVersionKey(phoneCatalog, formItem.baseModel, formItem.versionKey) : "";
    const displayModel = formItem.baseModel ? `${formItem.baseModel}${formItem.versionKey ? " " + formItem.versionKey : ""}` : "";
    if (!id || !model || !formItem.memory || !formItem.color) return;
    setError(null);
    setLoading(true);
    try {
      await api.post(`/purchases/${id}/items`, {
        model,
        displayModel: displayModel || undefined,
        memory: formItem.memory,
        color: formItem.color,
        quantityExpected: parseInt(formItem.quantityExpected, 10) || 1,
        unitCostCents: formItem.unitCostCents.trim() !== ""
          ? Math.round(parseFloat(formItem.unitCostCents.replace(",", ".")) * 100)
          : undefined
      });
      setFormItem({ baseModel: "", versionKey: "", memory: "", color: "", quantityExpected: "1", unitCostCents: "" });
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo agregar el ítem.");
    } finally {
      setLoading(false);
    }
  }

  async function onReceiveByImei(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formReceive.purchaseOrderItemId || !formReceive.imei.trim()) {
      setError("Seleccioná una línea y el IMEI.");
      return;
    }
    setReceiving(true);
    try {
      await api.post("/purchases/receive-by-imei", {
        purchaseOrderItemId: formReceive.purchaseOrderItemId,
        imei: formReceive.imei.replace(/\s/g, ""),
        condition: formReceive.condition
      });
      setFormReceive((p) => ({ ...p, imei: "" }));
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo registrar el equipo.");
    } finally {
      setReceiving(false);
    }
  }

  const pendingItems = order?.items.filter((i) => i.quantityReceived < i.quantityExpected) ?? [];
  const selectedLine = formReceive.purchaseOrderItemId ? pendingItems.find((i) => i.id === formReceive.purchaseOrderItemId) : null;

  const itemsTotalCents =
    order?.items.reduce((sum, i) => sum + i.quantityExpected * (i.unitCostCents ?? 0), 0) ?? 0;
  const orderTotalCents = order?.totalAmountCents ?? null;
  const totalsMatch =
    orderTotalCents == null || orderTotalCents === 0 || itemsTotalCents === orderTotalCents;

  function itemLabel(item: PurchaseOrderItem): string {
    const model = item.displayModel ?? item.model;
    if (model && item.memory && item.color) return `${model} ${item.memory} ${item.color}`;
    return item.modelLabel;
  }

  function openEditModal(item: PurchaseOrderItem) {
    setEditItem(item);
    setEditForm({
      quantityExpected: String(item.quantityExpected),
      unitCostCents: item.unitCostCents != null ? String(item.unitCostCents / 100) : ""
    });
    setError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!id || !editItem) return;
    const qty = parseInt(editForm.quantityExpected, 10);
    const costCents =
      editForm.unitCostCents.trim() !== ""
        ? Math.round(parseFloat(editForm.unitCostCents.replace(",", ".")) * 100)
        : undefined;
    if (!Number.isInteger(qty) || qty < 1) {
      setError("Cantidad debe ser un número entero mayor a 0.");
      return;
    }
    setEditSaving(true);
    setError(null);
    try {
      await api.patch(`/purchases/${id}/items/${editItem.id}`, {
        quantityExpected: qty,
        ...(costCents !== undefined && { unitCostCents: costCents })
      });
      setEditItem(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo actualizar el ítem.");
    } finally {
      setEditSaving(false);
    }
  }

  async function onDeleteItem(item: PurchaseOrderItem) {
    if (!id) return;
    if (item.quantityReceived > 0) {
      setError("No se puede eliminar un ítem con unidades ya recibidas.");
      return;
    }
    if (!window.confirm(`¿Eliminar la línea "${itemLabel(item)}" de la orden? Esta acción no se puede deshacer.`)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await api.delete(`/purchases/${id}/items/${item.id}`);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo eliminar el ítem.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!order) {
    return (
      <div>
        {error && <div className="silva-alert">{error}</div>}
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="silva-page-header" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link to="/purchases" className="silva-btn silva-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
          <ArrowLeft size={18} /> Volver
        </Link>
        <h2 className="silva-page-title" style={{ margin: 0 }}>
          Orden {order.orderNumber ?? order.id.slice(0, 8)} · {order.supplier.name}
        </h2>
        <span className="silva-badge silva-badge-primary">{order.statusPhysical}</span>
        <span className="silva-badge silva-badge-warning">{order.statusPayment}</span>
        {order.totalAmountCents != null && order.totalAmountCents > 0 && (
          <span style={{ marginLeft: "0.5rem", color: "var(--silva-muted)" }}>
            Total: {(order.totalAmountCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {order.currency}
          </span>
        )}
        {order.shippingCostCents != null && order.shippingCostCents > 0 && (
          <span className="silva-badge silva-badge-outline">
            Envío: {(order.shippingCostCents / 100).toFixed(2)} {order.currency}
          </span>
        )}
      </div>
      {error && <div className="silva-alert" style={{ marginBottom: "1rem" }}>{error}</div>}

      <Box className="mb-6">
        <span className="silva-badge silva-badge-primary" style={{ marginBottom: "0.75rem", display: "inline-block" }}>Agregar ítem a la orden</span>
        <p style={{ color: "var(--silva-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Acá cargás qué equipos tiene esta orden: modelo, memoria, color y cantidad. Después recibís cada unidad escaneando el IMEI más abajo.
        </p>
        <form onSubmit={onAddItem} className="silva-form-grid">
          <div className="silva-col-6">
            <label className="silva-label">Modelo *</label>
            <select
              className="silva-input"
              value={formItem.baseModel}
              onChange={(e) =>
                setFormItem((p) => ({
                  ...p,
                  baseModel: e.target.value,
                  versionKey: "",
                  memory: "",
                  color: ""
                }))
              }
              required
            >
              <option value="">Seleccionar</option>
              {getBaseModels(phoneCatalog).map((base) => (
                <option key={base} value={base}>
                  {base}
                </option>
              ))}
            </select>
          </div>
          <div className="silva-col-6">
            <label className="silva-label">Versión</label>
            <select
              className="silva-input"
              value={formItem.versionKey}
              onChange={(e) => {
                const v = e.target.value as "" | "Plus" | "Pro" | "Pro Max";
                setFormItem((p) => ({ ...p, versionKey: v, memory: "", color: "" }));
              }}
              disabled={!formItem.baseModel}
            >
              {getVersionOptions(phoneCatalog, formItem.baseModel).map((opt) => (
                <option key={opt.value || "base"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="silva-col-6">
            <label className="silva-label">Memoria *</label>
            <select
              className="silva-input"
              value={formItem.memory}
              onChange={(e) => setFormItem((p) => ({ ...p, memory: e.target.value }))}
              required
              disabled={!formItemModel}
            >
              <option value="">Seleccionar</option>
              {phoneCatalog
                .find((c) => c.model === formItemModel)
                ?.storages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>
          <div className="silva-col-6">
            <label className="silva-label">Color *</label>
            <select
              className="silva-input"
              value={formItem.color}
              onChange={(e) => setFormItem((p) => ({ ...p, color: e.target.value }))}
              required
              disabled={!formItemModel}
            >
              <option value="">Seleccionar</option>
              {phoneCatalog
                .find((c) => c.model === formItemModel)
                ?.colors.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
            </select>
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Cantidad</label>
            <input
              type="number"
              min={1}
              className="silva-input"
              value={formItem.quantityExpected}
              onChange={(e) => setFormItem((p) => ({ ...p, quantityExpected: e.target.value }))}
            />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Costo unit. (USD)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="silva-input"
              value={formItem.unitCostCents}
              onChange={(e) => setFormItem((p) => ({ ...p, unitCostCents: e.target.value }))}
              placeholder="Ej. 500"
            />
          </div>
          <div className="silva-col-2" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="silva-btn silva-btn-primary" disabled={loading}>
              Agregar ítem
            </button>
          </div>
        </form>
      </Box>

      {pendingItems.length > 0 && (
        <Box className="mb-6" style={{ borderLeft: "4px solid var(--silva-success)", paddingBottom: "3.5rem" }}>
          <span className="silva-badge silva-badge-success" style={{ marginBottom: "0.75rem", display: "inline-block" }}>
            Recepción por IMEI
          </span>
          <p style={{ color: "var(--silva-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Escaneá o ingresá el IMEI para dar de alta el equipo en el inventario. El costo incluye el prorrateo del envío.
          </p>
          <form onSubmit={onReceiveByImei} className="silva-form-grid">
            <div className="silva-col-4">
              <label className="silva-label">Línea *</label>
              <select
                className="silva-input"
                value={formReceive.purchaseOrderItemId}
                onChange={(e) => setFormReceive((p) => ({ ...p, purchaseOrderItemId: e.target.value }))}
              >
                <option value="">Seleccionar línea</option>
                {pendingItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {itemLabel(i)} — {i.quantityReceived}/{i.quantityExpected}
                  </option>
                ))}
              </select>
              {selectedLine && (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--silva-muted)" }}>
                  Recibiendo: {itemLabel(selectedLine)}
                </p>
              )}
            </div>
            <div className="silva-col-3">
              <label className="silva-label">IMEI *</label>
              <div
                className="silva-input-with-icon"
                role={isMobile() ? "button" : undefined}
                tabIndex={isMobile() ? 0 : undefined}
                onClick={() => isMobile() && setImeiScannerOpen(true)}
                onKeyDown={(e) => isMobile() && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setImeiScannerOpen(true))}
                style={isMobile() ? { cursor: "pointer" } : undefined}
              >
                <input
                  className="silva-input"
                  value={formReceive.imei}
                  onChange={(e) => setFormReceive((p) => ({ ...p, imei: e.target.value }))}
                  placeholder={isMobile() ? "Tocá para escanear código de barras" : "Escanear o ingresar IMEI"}
                  readOnly={isMobile()}
                  aria-label="IMEI (en móvil tocá para escanear)"
                />
                <span className="silva-input-with-icon__suffix" aria-hidden>
                  <Barcode size={18} />
                </span>
              </div>
            </div>
            <div className="silva-col-2">
              <label className="silva-label">Condición</label>
              <select
                className="silva-input"
                value={formReceive.condition}
                onChange={(e) => setFormReceive((p) => ({ ...p, condition: e.target.value as "sealed" | "used" }))}
              >
                <option value="sealed">Nuevo</option>
                <option value="used">Usado</option>
              </select>
            </div>
            <div className="silva-col-1" style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="silva-btn silva-btn-primary" disabled={receiving}>
                <Barcode size={16} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Recibir
              </button>
            </div>
          </form>
        </Box>
      )}

      {imeiScannerOpen && (
        <ImeiBarcodeScannerModal
          open={imeiScannerOpen}
          onClose={() => setImeiScannerOpen(false)}
          onScan={(digits) => {
            setFormReceive((p) => ({ ...p, imei: digits }));
            setImeiScannerOpen(false);
          }}
        />
      )}

      {editItem && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
          <div className="silva-modal" style={{ maxWidth: 420 }}>
            <h3 id="edit-item-title" className="silva-modal-title" style={{ margin: 0 }}>Editar ítem</h3>
            <p className="silva-helper" style={{ margin: "0.25rem 0 0.75rem" }}>{itemLabel(editItem)}</p>
            <form onSubmit={onSaveEdit}>
              <label className="silva-label">Cantidad esperada *</label>
              <input
                type="number"
                min={editItem.quantityReceived}
                className="silva-input"
                value={editForm.quantityExpected}
                onChange={(e) => setEditForm((p) => ({ ...p, quantityExpected: e.target.value }))}
                required
                style={{ marginBottom: "0.75rem" }}
              />
              <label className="silva-label">Costo unitario ({order.currency})</label>
              <input
                type="text"
                inputMode="decimal"
                className="silva-input"
                value={editForm.unitCostCents}
                onChange={(e) => setEditForm((p) => ({ ...p, unitCostCents: e.target.value }))}
                placeholder="Ej. 1000.00"
                style={{ marginBottom: "1rem" }}
              />
              {error && <div className="silva-alert" style={{ marginBottom: "1rem" }}>{error}</div>}
              <div className="silva-modal-actions">
                <button type="button" className="silva-btn" onClick={() => { setEditItem(null); setError(null); }} disabled={editSaving}>
                  Cancelar
                </button>
                <button type="submit" className="silva-btn silva-btn-primary" disabled={editSaving}>
                  {editSaving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Box className="p-0 overflow-hidden">
        <h3 style={{ padding: "1rem 1.25rem", margin: 0, fontSize: "1rem" }}>Ítems de la orden</h3>
        {!totalsMatch && orderTotalCents != null && orderTotalCents > 0 && (
          <div
            className="silva-alert"
            role="alert"
            style={{
              margin: "0 1.25rem 1rem",
              padding: "1rem 1.25rem",
              borderLeft: "4px solid var(--silva-warning)",
              backgroundColor: "var(--silva-primary-light)"
            }}
          >
            <strong>Total de ítems no coincide con el total de la OC.</strong>
            <br />
            <span style={{ fontSize: "0.9rem" }}>
              Suma de ítems: {(itemsTotalCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {order.currency}
              {" · "}
              Total OC: {(orderTotalCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {order.currency}.
              Revisá los costos unitarios de cada ítem o el total de la orden.
            </span>
          </div>
        )}
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Recibidos</th>
                <th>Costo unit.</th>
                <th>IMEIs recibidos</th>
                <th style={{ width: 120, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{itemLabel(item)}</td>
                  <td>
                    <span className={item.quantityReceived >= item.quantityExpected ? "silva-badge silva-badge-success" : "silva-badge silva-badge-warning"}>
                      {item.quantityReceived} / {item.quantityExpected}
                    </span>
                  </td>
                  <td>{item.unitCostCents != null ? `${(item.unitCostCents / 100).toFixed(2)} ${order.currency}` : "—"}</td>
                  <td>
                    {item.devices?.length ? item.devices.map((d) => <span key={d.id} style={{ display: "block", fontFamily: "monospace", fontSize: "0.85rem" }}>{d.imei}</span>) : "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="silva-btn silva-btn-ghost"
                      style={{ padding: "6px 8px", minWidth: 0 }}
                      onClick={() => openEditModal(item)}
                      title="Editar cantidad o costo"
                      aria-label="Editar ítem"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="silva-btn silva-btn-ghost"
                      style={{ padding: "6px 8px", minWidth: 0, color: "var(--silva-danger)" }}
                      onClick={() => onDeleteItem(item)}
                      disabled={item.quantityReceived > 0 || deletingId === item.id}
                      title={item.quantityReceived > 0 ? "No se puede eliminar: ya tiene unidades recibidas" : "Eliminar ítem"}
                      aria-label="Eliminar ítem"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {order.items.length > 0 && (
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1px solid var(--silva-border)",
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "center",
              backgroundColor: "var(--silva-bg)"
            }}
          >
            <strong>
              Total ítems: {(itemsTotalCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {order.currency}
            </strong>
            {orderTotalCents != null && orderTotalCents > 0 && (
              <>
                <span style={{ color: "var(--silva-muted)" }}>
                  Total OC: {(orderTotalCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {order.currency}
                </span>
                {totalsMatch ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      color: "#16a34a",
                      fontWeight: 600,
                      fontSize: "0.95rem"
                    }}
                    title="Los totales coinciden"
                  >
                    <CheckCircle size={20} strokeWidth={2.2} />
                    Totales correctos
                  </span>
                ) : (
                  <span className="silva-badge silva-badge-warning" style={{ marginLeft: "0.25rem" }}>
                    Los totales no coinciden — revisá los costos unitarios de cada ítem.
                  </span>
                )}
              </>
            )}
          </div>
        )}
        {order.items.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--silva-muted)" }}>No hay ítems. Agregá uno arriba.</div>
        )}
      </Box>
    </div>
  );
}
