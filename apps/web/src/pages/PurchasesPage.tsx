import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { ImeiBarcodeScannerModal } from "../components/ImeiBarcodeScannerModal";
import { isMobile } from "../utils/isMobile";
import { LordIcon } from "../components/LordIcon";

type Supplier = { id: string; name: string };
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
};
type PurchaseOrder = {
  id: string;
  orderNumber: string | null;
  currency: string;
  totalAmountCents?: number | null;
  statusPayment: string;
  statusPhysical: string;
  createdAt: string;
  supplier: Supplier;
  items: PurchaseOrderItem[];
};

export function PurchasesPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formOrder, setFormOrder] = useState<{
    supplierId: string;
    currency: "USD" | "ARS";
    totalAmount: string;
    shippingCost: string;
  }>({
    supplierId: "",
    currency: "USD",
    totalAmount: "",
    shippingCost: ""
  });
  const [formReceive, setFormReceive] = useState({
    purchaseOrderItemId: "",
    imei: "",
    condition: "sealed" as "sealed" | "used_a" | "used_ab"
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [imeiScannerOpen, setImeiScannerOpen] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  async function loadOrders() {
    try {
      const { data } = await api.get<{ orders: PurchaseOrder[] }>("/purchases");
      setOrders(data.orders ?? []);
    } catch {
      setError("No se pudo cargar órdenes.");
    }
  }

  async function loadSuppliers() {
    try {
      const { data } = await api.get<{ suppliers: Supplier[] }>("/suppliers");
      setSuppliers(data.suppliers ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadOrders();
    void loadSuppliers();
  }, []);

  async function onCreateOrder(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formOrder.supplierId) {
      setError("Seleccioná un proveedor.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ order: PurchaseOrder }>("/purchases", {
        supplierId: formOrder.supplierId,
        currency: formOrder.currency,
        totalAmountCents: formOrder.totalAmount.trim() !== "" && Number(formOrder.totalAmount) > 0 ? Math.round(Number(formOrder.totalAmount) * 100) : undefined,
        shippingCostCents: Math.round((parseFloat(formOrder.shippingCost) || 0) * 100)
      });
      setFormOrder((p) => ({ ...p, supplierId: "", totalAmount: "", shippingCost: "" }));
      await loadOrders();
      if (data.order?.id) navigate(`/purchases/${data.order.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo crear la orden.");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteOrder(order: PurchaseOrder, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const received = order.items?.reduce((a, i) => a + i.quantityReceived, 0) ?? 0;
    if (
      received > 0 &&
      !window.confirm(
        `Esta orden tiene ${received} equipo(s) ya recibidos en inventario. Al eliminar la orden se desvincularán de la línea de compra pero seguirán en stock. ¿Eliminar la orden "${order.orderNumber ?? order.id.slice(0, 8)}"?`
      )
    ) {
      return;
    }
    if (received === 0 && !window.confirm(`¿Eliminar la orden "${order.orderNumber ?? order.id.slice(0, 8)}"?`)) return;
    setDeletingOrderId(order.id);
    try {
      await api.delete(`/purchases/${order.id}`);
      await loadOrders();
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { error?: string } } }).response : undefined;
      window.alert(res?.data?.error ?? "No se pudo eliminar la orden.");
    } finally {
      setDeletingOrderId(null);
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
      await loadOrders();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo registrar el equipo.");
    } finally {
      setReceiving(false);
    }
  }

  function itemLabel(item: PurchaseOrderItem): string {
    const model = item.displayModel ?? item.model;
    if (model && item.memory && item.color) return `${model} ${item.memory} ${item.color}`;
    return item.modelLabel;
  }

  const allItems = orders.flatMap((o) =>
    o.items.map((item) => ({
      ...item,
      orderNumber: o.orderNumber,
      supplierName: o.supplier.name,
      orderId: o.id
    }))
  );
  const pendingItems = allItems.filter((i) => i.quantityReceived < i.quantityExpected);
  const selectedLine = formReceive.purchaseOrderItemId ? pendingItems.find((i) => i.id === formReceive.purchaseOrderItemId) : null;

  const formatOrderDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  return (
    <div>
      {error && (
        <div className="silva-alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <Box className="mb-6">
        <span className="silva-badge silva-badge-primary" style={{ marginBottom: "0.75rem", display: "inline-block" }}>
          Nueva orden de compra
        </span>
        <p style={{ color: "var(--silva-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Cargá el monto total de la compra (y el envío si corresponde). Después entrá a la orden para agregar los ítems (equipos) y recibir por IMEI.
        </p>
        <form onSubmit={onCreateOrder} className="silva-form-grid">
          <div className="silva-col-4">
            <label className="silva-label">Proveedor *</label>
            <select
              className="silva-input"
              value={formOrder.supplierId}
              onChange={(e) => setFormOrder((p) => ({ ...p, supplierId: e.target.value }))}
            >
              <option value="">Seleccionar proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="silva-col-6">
            <label className="silva-label">Total de la orden</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="silva-input"
              value={formOrder.totalAmount}
              onChange={(e) => setFormOrder((p) => ({ ...p, totalAmount: e.target.value }))}
              placeholder={`Ej. 1500 (${formOrder.currency})`}
            />
          </div>
          <div className="silva-col-6">
            <label className="silva-label">Moneda</label>
            <select
              className="silva-input"
              value={formOrder.currency}
              onChange={(e) => setFormOrder((p) => ({ ...p, currency: e.target.value as "USD" | "ARS" }))}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Costo de envío</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="silva-input"
              value={formOrder.shippingCost}
              onChange={(e) => setFormOrder((p) => ({ ...p, shippingCost: e.target.value }))}
              placeholder={`Ej. 50 (${formOrder.currency})`}
            />
          </div>
          <div className="silva-col-2" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="silva-btn silva-btn-primary" disabled={loading}>
              Crear orden
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
            Escaneá o ingresá el IMEI para dar de alta el equipo en el inventario y vincularlo a la orden.
          </p>
          <form onSubmit={onReceiveByImei} className="silva-form-grid">
            <div className="silva-col-4">
              <label className="silva-label">Línea de orden *</label>
              <select
                className="silva-input"
                value={formReceive.purchaseOrderItemId}
                onChange={(e) => setFormReceive((p) => ({ ...p, purchaseOrderItemId: e.target.value }))}
              >
                <option value="">Seleccionar línea</option>
                {pendingItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {itemLabel(i)} — {i.quantityReceived}/{i.quantityExpected} recibidos · {i.supplierName}
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
                  <LordIcon name="barcode" size={18} />
                </span>
              </div>
            </div>
            <div className="silva-col-2">
              <label className="silva-label">Condición</label>
              <select
                className="silva-input"
                value={formReceive.condition}
                onChange={(e) => setFormReceive((p) => ({ ...p, condition: e.target.value as "sealed" | "used_a" | "used_ab" }))}
              >
                <option value="sealed">Nuevo</option>
                <option value="used_a">Usado grado A</option>
                <option value="used_ab">Usado grado AB</option>
              </select>
            </div>
            <div className="silva-col-1" style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="silva-btn silva-btn-primary" disabled={receiving}>
                <LordIcon name="barcode" size={18} />
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

      <Box className="p-0 overflow-hidden">
        <h3 style={{ padding: "1rem 1.25rem", margin: 0, fontSize: "1rem" }}>Órdenes de compra</h3>
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th>Estado pago</th>
                <th>Estado físico</th>
                <th>Ítems</th>
                <th>Nº</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/purchases/${order.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/purchases/${order.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{formatOrderDate(order.createdAt)}</td>
                  <td>{order.supplier.name}</td>
                  <td>
                    {order.totalAmountCents != null ? (
                      <span>{(order.totalAmountCents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {order.currency}</span>
                    ) : (
                      <span style={{ color: "var(--silva-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const status = order.statusPayment?.toLowerCase();
                      const paid = status === "paid";
                      const partial = status === "partial";
                      const label = paid ? "Pagado" : partial ? "Parcial" : "Sin pagar";
                      const badgeClass = paid
                        ? "silva-badge silva-badge-success"
                        : partial
                          ? "silva-badge silva-badge-warning"
                          : "silva-badge silva-badge-danger";
                      return <span className={badgeClass}>{label}</span>;
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const status = order.statusPhysical?.toLowerCase();
                      const received = status === "received";
                      const partial = status === "partial";
                      const label = received ? "Recibido" : partial ? "Parcial" : "Pendiente";
                      const badgeClass = received
                        ? "silva-badge silva-badge-success"
                        : partial
                          ? "silva-badge silva-badge-warning"
                          : "silva-badge silva-badge-danger";
                      return <span className={badgeClass}>{label}</span>;
                    })()}
                  </td>
                  <td>
                    {order.items.length} línea(s) ·{" "}
                    {order.items.reduce((a, i) => a + i.quantityReceived, 0)}/
                    {order.items.reduce((a, i) => a + i.quantityExpected, 0)} uds
                  </td>
                  <td>
                    <span style={{ fontFamily: "monospace" }}>{order.orderNumber ?? order.id.slice(0, 8)}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="silva-btn"
                      style={{
                        fontSize: "0.85rem",
                        padding: "4px 8px",
                        color: "var(--silva-danger, #c00)",
                        borderColor: "var(--silva-danger, #c00)"
                      }}
                      onClick={(e) => onDeleteOrder(order, e)}
                      disabled={deletingOrderId === order.id}
                      title="Eliminar orden de compra"
                    >
                      {deletingOrderId === order.id ? "..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--silva-muted)" }}>
            No hay órdenes de compra. Creá una arriba.
          </div>
        )}
      </Box>
    </div>
  );
}
