import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";
import { CheckSquare, Package, Smartphone, BarChart2, ChevronRight, ChevronLeft } from "lucide-react";
import { LordIcon } from "../components/LordIcon";
import { ImeiBarcodeScannerModal } from "../components/ImeiBarcodeScannerModal";
import { isMobile } from "../utils/isMobile";
import { getBaseModels, getVersionOptions, getModelForVersionKey } from "../utils/phoneCatalogGroup";

type Device = {
  id: string;
  serialNumber?: string;
  imei: string;
  model: string;
  modelDisplay?: string | null;
  color?: string;
  memory?: string;
  warrantyStatus?: string;
  batteryCycles?: number;
  state: string;
  condition?: string;
  batteryHealth?: number;
  batteryStatus?: string;
  costCents?: number | null;
  technician?: { id: string; name: string } | null;
  repairRecords?: Array<{ id: string; reason?: string | null; notes?: string | null; priceCents?: number | null; sentAt: string }>;
  status?: { key: string; name: string; sector: string; isSellable: boolean; isVisibleForReseller: boolean };
  reseller?: { user: { name: string } };
  purchaseOrderItem?: {
    displayModel?: string | null;
    purchaseOrder?: { id: string; orderNumber: string | null };
  } | null;
};

import { deviceModelOnly } from "../utils/deviceLabel";

/** Un producto en stock: modelo real (ej. "iPhone 13 Pro", "iPhone 13 Pro Max") con sus memorias y dispositivos. */
type ModelGroup = {
  model: string;
  total: number;
  memories: Array<{ memory: string; devices: Device[] }>;
};

type DeviceStatus = {
  key: string;
  name: string;
  sector: "office" | "consignment" | "orders" | "reservations";
  isSellable: boolean;
  isVisibleForReseller: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function InventoryPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [mainSection, setMainSection] = useState<"sealed" | "used" | "technical_service">("sealed");
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<DeviceStatus[]>([]);
  const [sector, setSector] = useState<"office" | "consignment" | "orders" | "reservations" | "all" | "pendescanear">("office");
  const [selectedModelGroup, setSelectedModelGroup] = useState<ModelGroup | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ memory: string; color: string; devices: Device[] } | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; offers: Array<{ id: string; name: string; variants: Array<{ id: string; label: string }> }> }>>([]);
  const [requestForm, setRequestForm] = useState({ variantId: "", title: "", quantity: "1", note: "" });
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [phoneCatalog, setPhoneCatalog] = useState<Array<{ model: string; label: string; colors: string[]; storages: string[] }>>([]);
  const [tradeInForm, setTradeInForm] = useState({
    imei: "",
    baseModel: "",
    versionKey: "" as "" | "Plus" | "Pro" | "Pro Max",
    memory: "",
    color: "",
    batteryHealth: "",
    batteryCycles: ""
  });
  const tradeInModel = tradeInForm.baseModel
    ? getModelForVersionKey(phoneCatalog, tradeInForm.baseModel, tradeInForm.versionKey)
    : "";
  const [tradeInLoading, setTradeInLoading] = useState(false);
  const [imeiScannerOpen, setImeiScannerOpen] = useState(false);
  const [tradeInCardOpen, setTradeInCardOpen] = useState(false);
  const [pendingToScan, setPendingToScan] = useState<number>(0);
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([]);
  const [technicianFilterId, setTechnicianFilterId] = useState<string>("");
  const [sendToTechDevice, setSendToTechDevice] = useState<Device | null>(null);
  const [sendToTechTechnicianId, setSendToTechTechnicianId] = useState("");
  const [sendToTechReason, setSendToTechReason] = useState("");
  const [sendToTechNotes, setSendToTechNotes] = useState("");
  const [sendToTechPrice, setSendToTechPrice] = useState("");
  const [sendToTechSaving, setSendToTechSaving] = useState(false);
  const [returnPriceDevice, setReturnPriceDevice] = useState<{ deviceId: string; repairRecordId: string; imei: string } | null>(null);
  const [returnPriceValue, setReturnPriceValue] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [editRepairDevice, setEditRepairDevice] = useState<Device | null>(null);
  const [editRepairForm, setEditRepairForm] = useState({ reason: "", notes: "", price: "" });
  const [editRepairSaving, setEditRepairSaving] = useState(false);
  const [repairHistoryDevice, setRepairHistoryDevice] = useState<Device | null>(null);
  const [repairHistoryRecords, setRepairHistoryRecords] = useState<Array<{
    id: string; reason?: string | null; notes?: string | null; priceCents?: number | null; sentAt: string; returnedAt?: string | null;
    technician: { id: string; name: string };
  }>>([]);
  const [pendingItems, setPendingItems] = useState<Array<{
    id: string;
    orderId: string;
    orderNumber: string | null;
    modelLabel: string;
    model: string;
    displayModel: string | null;
    memory: string | null;
    color: string | null;
    quantityExpected: number;
    quantityReceived: number;
    pending: number;
  }>>([]);

  async function load() {
    try {
      setError(null);
      const [devicesRes, statusesRes] = await Promise.all([
        api.get("/devices", { params: { pageSize: 2000 } }),
        api.get("/device-statuses")
      ]);
      setDevices(devicesRes.data.devices ?? []);
      setStatuses(statusesRes.data.statuses ?? []);
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { message?: string }; status?: number } }).response : undefined;
      const status = res?.status;
      const msg =
        res?.data?.message ??
        (status === 500
          ? "Error del servidor (500) al cargar inventario. Revisá la terminal de la API: base de datos (Prisma) y migraciones."
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Error al cargar inventario");
      setError(msg);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      api.get<{ pendingToScan: number }>("/purchases/pending-to-scan").then(
        (r) => setPendingToScan(r.data.pendingToScan ?? 0),
        () => setPendingToScan(0)
      );
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === "admin" && sector === "pendescanear") {
      setSelectedModelGroup(null);
      api.get<{ pendingItems: Array<{
        id: string; orderId: string; orderNumber: string | null; modelLabel: string;
        model: string; displayModel: string | null; memory: string | null; color: string | null;
        quantityExpected: number; quantityReceived: number; pending: number;
      }> }>("/purchases/pending-items").then(
        (r) => setPendingItems(r.data.pendingItems ?? []),
        () => setPendingItems([])
      );
    } else {
      setPendingItems([]);
    }
  }, [user?.role, sector]);

  useEffect(() => {
    api.get<{ catalog: Array<{ model: string; label: string; colors: string[]; storages: string[] }> }>("/catalog/phone-models").then(
      (r) => setPhoneCatalog(r.data.catalog ?? []),
      () => setPhoneCatalog([])
    );
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      api.get<{ technicians: Array<{ id: string; name: string }> }>("/technicians").then(
        (r) => setTechnicians(r.data.technicians ?? []),
        () => setTechnicians([])
      );
    }
  }, [user?.role]);

  async function sendDeviceToTechnician() {
    if (!sendToTechDevice || !sendToTechTechnicianId) return;
    setSendToTechSaving(true);
    setError(null);
    try {
      const priceCents = sendToTechPrice.trim() !== ""
        ? Math.round(parseFloat(sendToTechPrice.replace(",", ".")) * 100)
        : undefined;
      await api.post("/repair-records", {
        deviceId: sendToTechDevice.id,
        technicianId: sendToTechTechnicianId,
        reason: sendToTechReason.trim() || undefined,
        notes: sendToTechNotes.trim() || undefined,
        priceCents
      });
      setSendToTechDevice(null);
      setSendToTechTechnicianId("");
      setSendToTechReason("");
      setSendToTechNotes("");
      setSendToTechPrice("");
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo enviar el equipo al técnico.");
    } finally {
      setSendToTechSaving(false);
    }
  }

  function openReturnModal(device: Device) {
    const openRecord = device.repairRecords?.[0];
    if (!openRecord) return;
    setReturnPriceDevice({ deviceId: device.id, repairRecordId: openRecord.id, imei: device.imei });
    setReturnPriceValue(openRecord.priceCents != null ? String(openRecord.priceCents / 100) : "");
    setError(null);
  }

  async function confirmReturnFromTechnician() {
    if (!returnPriceDevice) return;
    setReturnSaving(true);
    setError(null);
    try {
      const priceCents = returnPriceValue.trim() !== ""
        ? Math.round(parseFloat(returnPriceValue.replace(",", ".")) * 100)
        : undefined;
      await api.post(`/repair-records/${returnPriceDevice.repairRecordId}/return`, priceCents != null ? { priceCents } : {});
      setReturnPriceDevice(null);
      setReturnPriceValue("");
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo cerrar la reparación.");
    } finally {
      setReturnSaving(false);
    }
  }

  function openEditRepairModal(device: Device) {
    const openRecord = device.repairRecords?.[0];
    if (!openRecord) return;
    setEditRepairDevice(device);
    setEditRepairForm({
      reason: openRecord.reason ?? "",
      notes: openRecord.notes ?? "",
      price: openRecord.priceCents != null ? String(openRecord.priceCents / 100) : ""
    });
    setError(null);
  }

  async function saveEditRepair() {
    if (!editRepairDevice) return;
    const openRecord = editRepairDevice.repairRecords?.[0];
    if (!openRecord) return;
    setEditRepairSaving(true);
    setError(null);
    try {
      const priceCents = editRepairForm.price.trim() !== ""
        ? Math.round(parseFloat(editRepairForm.price.replace(",", ".")) * 100)
        : null;
      await api.patch(`/repair-records/${openRecord.id}`, {
        reason: editRepairForm.reason.trim() || undefined,
        notes: editRepairForm.notes.trim() || undefined,
        priceCents
      });
      setEditRepairDevice(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo actualizar la reparación.");
    } finally {
      setEditRepairSaving(false);
    }
  }

  async function loadRepairHistory(device: Device) {
    setRepairHistoryDevice(device);
    try {
      const { data } = await api.get<{ repairRecords: Array<{
        id: string; reason?: string | null; notes?: string | null; priceCents?: number | null; sentAt: string; returnedAt?: string | null;
        technician: { id: string; name: string };
      }> }>(`/repair-records`, { params: { deviceId: device.id } });
      setRepairHistoryRecords(data.repairRecords ?? []);
    } catch {
      setRepairHistoryRecords([]);
    }
  }

  async function onSubmitTradeIn(e: FormEvent) {
    e.preventDefault();
    const imei = tradeInForm.imei.replace(/\s/g, "");
    if (!imei || !/^\d{10,20}$/.test(imei)) {
      setError("IMEI obligatorio (10 a 20 dígitos).");
      return;
    }
    if (!tradeInModel || !tradeInForm.memory || !tradeInForm.color) {
      setError("Modelo, memoria y color son obligatorios.");
      return;
    }
    setError(null);
    setTradeInLoading(true);
    try {
      const body: Record<string, unknown> = {
        imei,
        model: tradeInModel,
        memory: tradeInForm.memory,
        color: tradeInForm.color,
        condition: "used",
        sourceType: "trade_in"
      };
      if (tradeInForm.batteryHealth !== "") {
        const health = Number(tradeInForm.batteryHealth);
        if (Number.isFinite(health) && health >= 0 && health <= 100) body.batteryHealth = health;
      }
      if (tradeInForm.batteryCycles !== "") {
        const cycles = Number(tradeInForm.batteryCycles);
        if (Number.isFinite(cycles) && cycles >= 0) body.batteryCycles = cycles;
      }
      await api.post("/devices", body);
      setTradeInForm({
        imei: "",
        baseModel: "",
        versionKey: "",
        memory: "",
        color: "",
        batteryHealth: "",
        batteryCycles: ""
      });
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo dar de alta el equipo.");
    } finally {
      setTradeInLoading(false);
    }
  }

  function parseModelRank(model: string): number {
    const m = model.toLowerCase();
    const v = m.match(/iphone\s*(\d+)/i);
    const version = v ? Number(v[1]) : 0;
    let tier = 0;
    if (m.includes("pro max")) tier = 40;
    else if (m.includes("pro")) tier = 30;
    else if (m.includes("plus")) tier = 20;
    else if (m.includes("mini")) tier = 5;
    return version * 100 + tier;
  }

  /** Agrupa por modelo real (deviceModelOnly: ej. "iPhone 13 Pro", "iPhone 13 Pro Max") y luego por memoria. Sin juntar Pro con Pro Max ni 13 con mini. */
  function groupByModelAndMemory(source: Device[]) {
    const modelMap = new Map<string, Map<string, Device[]>>();
    for (const d of source) {
      const model = deviceModelOnly(d) || "Sin modelo";
      const memory = d.memory || "Sin memoria";
      if (!modelMap.has(model)) modelMap.set(model, new Map());
      const memMap = modelMap.get(model)!;
      if (!memMap.has(memory)) memMap.set(memory, []);
      memMap.get(memory)!.push(d);
    }
    return [...modelMap.entries()]
      .sort((a, b) => parseModelRank(b[0]) - parseModelRank(a[0]) || a[0].localeCompare(b[0]))
      .map(([model, memoryMap]) => ({
        model,
        total: [...memoryMap.values()].reduce((acc, arr) => acc + arr.length, 0),
        memories: [...memoryMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([memory, devicesInMemory]) => ({ memory, devices: devicesInMemory }))
      }));
  }

  async function openRequestModal() {
    setRequestError(null);
    setRequestForm({ variantId: "", title: "", quantity: "1", note: "" });
    try {
      const { data } = await api.get("/stock/catalog");
      setCatalog(data.categories ?? []);
      setRequestModalOpen(true);
    } catch {
      setRequestError("No se pudo cargar catálogo ofertable.");
      setRequestModalOpen(true);
    }
  }

  async function submitStockRequest(e: FormEvent) {
    e.preventDefault();
    const quantity = Number(requestForm.quantity);
    if (!requestForm.title.trim()) {
      setRequestError("El título del pedido es obligatorio.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setRequestError("La cantidad debe ser mayor a 0.");
      return;
    }
    setRequestLoading(true);
    setRequestError(null);
    try {
      await api.post("/stock/requests", {
        variantId: requestForm.variantId || undefined,
        title: requestForm.title.trim(),
        quantity,
        note: requestForm.note.trim() || undefined
      });
      setRequestModalOpen(false);
    } catch (err: any) {
      setRequestError(err?.response?.data?.message ?? "No se pudo crear la solicitud.");
    } finally {
      setRequestLoading(false);
    }
  }

  const statusMap = Object.fromEntries(statuses.map((s) => [s.key, s])) as Record<string, DeviceStatus>;
  const devicesInSection =
    user?.role === "admin"
      ? devices.filter((d) => (d.condition ?? "sealed") === mainSection)
      : devices;
  const catalogSet = new Set(phoneCatalog.map((c) => c.model));
  const devicesInSectionFiltered =
    phoneCatalog.length > 0 ? devicesInSection.filter((d) => catalogSet.has(d.model)) : devicesInSection;
  const officeCount = devicesInSectionFiltered.filter((d) => (statusMap[d.state]?.sector ?? "office") === "office").length;
  const consignmentCount = devicesInSectionFiltered.filter((d) => (statusMap[d.state]?.sector ?? "office") === "consignment").length;
  const totalInSection = devicesInSectionFiltered.length;

  const stockKpiCards = [
    { key: "office" as const, label: "Disponibles", value: officeCount, icon: CheckSquare, modifier: "disponibles" },
    { key: "consignment" as const, label: "En consignación", value: consignmentCount, icon: Package, modifier: "consignment" },
    { key: "pendescanear" as const, label: "Pend. Escanear", value: pendingToScan, icon: Smartphone, modifier: "pendescanear" },
    { key: "total" as const, label: "Total", value: totalInSection, icon: BarChart2, modifier: "total" }
  ];

  const scopedDevices =
    user?.role === "admin"
      ? devices
          .filter((d) => (d.condition ?? "sealed") === mainSection)
          .filter((d) => {
            if (mainSection === "technical_service") {
              return technicianFilterId ? d.technician?.id === technicianFilterId : true;
            }
            return sector === "all" || sector === "pendescanear" || (statusMap[d.state]?.sector ?? "office") === sector;
          })
      : devices;

  const catalogModelSet = new Set(phoneCatalog.map((c) => c.model));
  const filteredScopedDevices =
    phoneCatalog.length > 0 ? scopedDevices.filter((d) => catalogModelSet.has(d.model)) : scopedDevices;

  const grouped = groupByModelAndMemory(filteredScopedDevices);


  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Inventario de equipos</h2>
      </div>
      {error && (
        <div className="silva-alert" role="alert">
          {error}
        </div>
      )}

      {/* Card unificada: Compras + Trade-in (solo admin) */}
      {user?.role === "admin" && (
        <Box className="mb-6" style={{ borderLeft: "4px solid var(--silva-primary)" }}>
          <p className="silva-helper" style={{ marginBottom: "1rem" }}>
            El stock por compras se carga desde <strong>Compras</strong>: creá una orden, agregá ítems en la orden y recibí cada unidad escaneando el IMEI ahí. Acá solo se da de alta equipo en <strong>trade-in</strong> (cliente).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center" }}>
            <Link to="/purchases" className="silva-btn silva-btn-primary">
              Ir a Compras
            </Link>
            <button
              type="button"
              className="silva-btn silva-btn-ghost"
              onClick={() => setTradeInCardOpen((o) => !o)}
              aria-expanded={tradeInCardOpen}
              aria-label={tradeInCardOpen ? "Contraer formulario de trade-in" : "Desplegar formulario de trade-in"}
            >
              {tradeInCardOpen ? "▼" : "▶"} Agregar equipo Trade-in
            </button>
          </div>
          {tradeInCardOpen && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--silva-border)" }}>
              <form onSubmit={onSubmitTradeIn} className="silva-form-grid">
              <div className="silva-col-4">
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
                    value={tradeInForm.imei}
                    onChange={(e) => setTradeInForm((p) => ({ ...p, imei: e.target.value }))}
                    placeholder={isMobile() ? "Tocá para escanear código de barras" : "Solo dígitos"}
                    readOnly={isMobile()}
                    aria-label="IMEI (en móvil tocá para escanear)"
                  />
                  <span className="silva-input-with-icon__suffix" aria-hidden>
                    <LordIcon name="barcode" size={18} />
                  </span>
                </div>
              </div>
              <div className="silva-col-4">
                <label className="silva-label">Modelo *</label>
                <select
                  className="silva-input"
                  value={tradeInForm.baseModel}
                  onChange={(e) =>
                    setTradeInForm((p) => ({
                      ...p,
                      baseModel: e.target.value,
                      model: "",
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
              <div className="silva-col-4">
                <label className="silva-label">Versión *</label>
                <select
                  className="silva-input"
                  value={tradeInForm.versionKey}
                  onChange={(e) => {
                    const v = e.target.value as "" | "Plus" | "Pro" | "Pro Max";
                    setTradeInForm((p) => ({ ...p, versionKey: v, memory: "", color: "" }));
                  }}
                  disabled={!tradeInForm.baseModel}
                >
                  {getVersionOptions(phoneCatalog, tradeInForm.baseModel).map((opt) => (
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
                  value={tradeInForm.memory}
                  onChange={(e) => setTradeInForm((p) => ({ ...p, memory: e.target.value }))}
                  required
                  disabled={!tradeInModel}
                >
                  <option value="">Seleccionar</option>
                  {phoneCatalog
                    .find((c) => c.model === tradeInModel)
                    ?.storages.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
              </div>
              <div className="silva-col-6">
                <label className="silva-label">Color *</label>
                <select
                  className="silva-input"
                  value={tradeInForm.color}
                  onChange={(e) => setTradeInForm((p) => ({ ...p, color: e.target.value }))}
                  required
                  disabled={!tradeInModel}
                >
                  <option value="">Seleccionar</option>
                  {phoneCatalog
                    .find((c) => c.model === tradeInModel)
                    ?.colors.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                </select>
              </div>
              <div className="silva-col-4">
                <label className="silva-label">Condición de Batería</label>
                <input
                  className="silva-input"
                  type="number"
                  min={0}
                  max={100}
                  value={tradeInForm.batteryHealth}
                  onChange={(e) =>
                    setTradeInForm((p) => ({
                      ...p,
                      batteryHealth: e.target.value
                    }))
                  }
                  placeholder="Ej: 92 (%)"
                  aria-label="Condición de la batería en porcentaje"
                />
              </div>
              <div className="silva-col-4">
                <label className="silva-label">Ciclos de carga</label>
                <input
                  className="silva-input"
                  type="number"
                  min={0}
                  max={5000}
                  value={tradeInForm.batteryCycles}
                  onChange={(e) =>
                    setTradeInForm((p) => ({
                      ...p,
                      batteryCycles: e.target.value
                    }))
                  }
                  placeholder="Ej: 150"
                  aria-label="Ciclos de carga"
                />
              </div>
              <div className="silva-col-4" style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 2 }}>
                <button type="submit" className="silva-btn silva-btn-primary" disabled={tradeInLoading}>
                  <LordIcon name="barcode" size={16} />
                  {tradeInLoading ? "Guardando…" : "Dar de alta"}
                </button>
              </div>
              </form>
            </div>
          )}
        </Box>
      )}

      {/* Muestra de stock: KPI cards 2x2 clicables; al tocar una card de modelo se abre la vista detalle */}
      {user?.role === "admin" && (mainSection === "sealed" || mainSection === "used" || mainSection === "technical_service") && (
        <>
          <div className="silva-stock-kpi-grid" style={{ marginBottom: 16 }}>
            {stockKpiCards.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.key === "total" && sector === "all") ||
              (item.key === "pendescanear" && sector === "pendescanear") ||
              (item.key !== "total" && item.key !== "pendescanear" && sector === item.key);
            return (
              <button
                key={item.key}
                type="button"
                className={`silva-stock-kpi-card silva-stock-kpi-card--${item.modifier} ${isActive ? "is-active" : ""}`}
                onClick={() => setSector(item.key === "total" ? "all" : item.key)}
                aria-pressed={isActive}
              >
                <div className="silva-stock-kpi-card__content">
                  <div>
                    <div className="silva-stock-kpi-card__label">{item.label}</div>
                    <div className="silva-stock-kpi-card__value">{item.value}</div>
                  </div>
                  <div className="silva-stock-kpi-card__icon" aria-hidden>
                    <Icon size={20} />
                  </div>
                </div>
              </button>
            );
          })}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
            <button
              type="button"
              className={`silva-btn ${mainSection === "sealed" ? "silva-btn-primary" : "silva-btn-ghost"}`}
              onClick={() => setMainSection("sealed")}
            >
              Sellados
            </button>
            <button
              type="button"
              className={`silva-btn ${mainSection === "used" ? "silva-btn-primary" : "silva-btn-ghost"}`}
              onClick={() => setMainSection("used")}
            >
              Usados
            </button>
            <button
              type="button"
              className={`silva-btn ${mainSection === "technical_service" ? "silva-btn-primary" : "silva-btn-ghost"}`}
              onClick={() => setMainSection("technical_service")}
            >
              En técnico
            </button>
          </div>
          {mainSection === "technical_service" && technicians.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label className="silva-label" style={{ margin: 0 }}>Filtrar por técnico:</label>
              <select
                className="silva-input"
                value={technicianFilterId}
                onChange={(e) => setTechnicianFilterId(e.target.value)}
                style={{ maxWidth: 260 }}
              >
                <option value="">Todos</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {user?.role !== "admin" && (
        <Box className="mb-6">
          <p className="silva-helper">Podés ver stock ofertable y solicitar productos especiales sin stock.</p>
          <button type="button" className="silva-btn silva-btn-primary" onClick={openRequestModal}>
            Solicitar producto sin stock
          </button>
        </Box>
      )}

      {(mainSection === "sealed" || mainSection === "used" || mainSection === "technical_service" || user?.role !== "admin") && (
        <>
          {selectedModelGroup ? (
            selectedVariant ? (
              /* Vista detalle: lista de equipos con IMEI */
              <div className="silva-stock-detail">
                <button
                  type="button"
                  className="silva-stock-detail-back"
                  onClick={() => setSelectedVariant(null)}
                >
                  <ChevronLeft size={20} aria-hidden />
                  <span>Volver</span>
                </button>
                <h2 className="silva-stock-detail-title">{selectedModelGroup.model}</h2>
                <p className="silva-stock-detail-subtitle">
                  {selectedVariant.color} · {selectedVariant.memory}
                </p>
                <div className="silva-stock-detail__panel">
                <div className="silva-table-wrap">
                  <table className="silva-table">
                    <thead>
                      <tr>
                        <th>IMEI</th>
                        <th>N° de serie</th>
                        <th>Batería</th>
                        <th>Garantía</th>
                        <th>Estado</th>
                        {user?.role === "admin" && mainSection === "technical_service" && <th>Técnico</th>}
                        {user?.role === "admin" && <th>Origen compra</th>}
                        {user?.role === "admin" && (mainSection === "sealed" || mainSection === "used" || mainSection === "technical_service") && (
                          <th style={{ width: 220 }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVariant.devices.map((device) => {
                        const sealed = device.condition?.toLowerCase() === "sealed";
                        const inTech = device.condition === "technical_service";
                        const health = device.batteryHealth ?? (sealed ? 100 : null);
                        const cycles = device.batteryCycles ?? (sealed ? 0 : null);
                        const warrantyText =
                          device.warrantyStatus != null && device.warrantyStatus !== ""
                            ? device.warrantyStatus
                            : sealed
                              ? "1 año"
                              : "—";
                        return (
                          <tr key={device.id}>
                            <td className="font-mono">{device.imei}</td>
                            <td>{device.serialNumber ?? "—"}</td>
                            <td>
                              {health != null || cycles != null
                                ? `${health != null ? `${health}%` : "—"} - ${cycles != null ? `${cycles}` : "—"}C`
                                : "—"}
                            </td>
                            <td>
                              {warrantyText}
                              {sealed && <span style={{ display: "block", fontSize: "0.8em", color: "var(--silva-muted)" }}>(sellado)</span>}
                            </td>
                            <td>{statusMap[device.state]?.name ?? device.state}</td>
                            {user?.role === "admin" && mainSection === "technical_service" && (
                              <td>{device.technician?.name ?? "—"}</td>
                            )}
                            {user?.role === "admin" && (
                              <td>
                                {device.purchaseOrderItem?.purchaseOrder ? (
                                  <Link to={`/purchases/${device.purchaseOrderItem.purchaseOrder.id}`} className="silva-link">
                                    {device.purchaseOrderItem.purchaseOrder.orderNumber ?? "Orden"}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </td>
                            )}
                            {user?.role === "admin" && (mainSection === "sealed" || mainSection === "used" || mainSection === "technical_service") && (
                              <td style={{ whiteSpace: "nowrap" }}>
                                {inTech ? (
                                  <>
                                    <button type="button" className="silva-btn silva-btn-ghost" onClick={() => openEditRepairModal(device)}>Editar reparación</button>
                                    <button type="button" className="silva-btn silva-btn-ghost" onClick={() => openReturnModal(device)}>Quitar de técnico</button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="silva-btn silva-btn-ghost"
                                    onClick={() => {
                                      setSendToTechDevice(device);
                                      setSendToTechTechnicianId(technicians[0]?.id ?? "");
                                      setSendToTechReason("");
                                      setSendToTechNotes("");
                                      setSendToTechPrice("");
                                      setSendToTechNotes("");
                                      setSendToTechPrice("");
                                    }}
                                  >
                                    Enviar a técnico
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="silva-btn silva-btn-ghost"
                                  onClick={() => loadRepairHistory(device)}
                                  title="Ver historial de reparaciones de este IMEI"
                                >
                                  Ver historial
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            ) : (
              /* Vista grid memoria/color para este modelo (ej. iPhone 13 Pro) */
              <div className="silva-stock-detail">
                <button
                  type="button"
                  className="silva-stock-detail-back"
                  onClick={() => setSelectedModelGroup(null)}
                >
                  <ChevronLeft size={20} aria-hidden />
                  <span>Volver</span>
                </button>
                <h2 className="silva-stock-detail-title">{selectedModelGroup.model}</h2>
                <p className="silva-stock-detail-subtitle">Disponibles para venta</p>
                <div className="silva-stock-detail__panel">
                <div className="silva-stock-variant-grid">
                  {(() => {
                    const totalModel = selectedModelGroup.total;
                    const cells: Array<{ memory: string; color: string; sealed: number; used: number; total: number; devices: Device[] }> = [];
                    for (const mem of selectedModelGroup.memories) {
                      const byColor = new Map<string, { sealed: number; used: number; devices: Device[] }>();
                      for (const d of mem.devices) {
                        const c = d.color ?? "—";
                        if (!byColor.has(c)) byColor.set(c, { sealed: 0, used: 0, devices: [] });
                        const entry = byColor.get(c)!;
                        entry.devices.push(d);
                        if (d.condition?.toLowerCase() === "sealed") entry.sealed++; else entry.used++;
                      }
                      for (const [color, entry] of byColor) {
                        cells.push({
                          memory: mem.memory,
                          color,
                          sealed: entry.sealed,
                          used: entry.used,
                          total: entry.devices.length,
                          devices: entry.devices
                        });
                      }
                    }
                    return cells.map((v, i) => {
                      const pct = totalModel > 0 ? Math.round((v.total / totalModel) * 100) : 0;
                      const conditionText = [v.sealed > 0 && `${v.sealed} Nuevo`, v.used > 0 && `${v.used} Usado`].filter(Boolean).join(" · ");
                      return (
                        <button
                          key={`${v.memory}-${v.color}-${i}`}
                          type="button"
                          className="silva-stock-variant-card"
                          style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer", font: "inherit", padding: 14 }}
                          onClick={() => setSelectedVariant({ memory: v.memory, color: v.color, devices: v.devices })}
                        >
                          <div className="silva-stock-variant-card__badge">{v.total}</div>
                          <div className="silva-stock-variant-card__title">{v.color}</div>
                          <div className="silva-stock-variant-card__subtitle">{v.memory}</div>
                          <div className="silva-stock-variant-card__condition">{conditionText}</div>
                          <div className="silva-stock-variant-card__progress-wrap">
                            <div className="silva-stock-variant-card__progress" style={{ width: `${pct}%` }} />
                            <span className="silva-stock-variant-card__progress-label">{pct}%</span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
                </div>
              </div>
            )
          ) : (
            <>
              {user?.role === "admin" && (mainSection === "sealed" || mainSection === "used") && (
                <div className="silva-stock-section-title" style={{ marginTop: 8 }}>
                  <div className="silva-stock-section-title__bar" aria-hidden />
                  <span className="silva-stock-section-title__text">
                    {sector === "office" && "Disponibles para venta"}
                    {sector === "consignment" && "En consignación"}
                    {sector === "pendescanear" && "Pend. Escanear"}
                    {sector === "reservations" && "Reservas"}
                    {sector === "all" && "Total"}
                  </span>
                  <span className="silva-stock-section-title__count">
                    {sector === "pendescanear"
                      ? `${pendingItems.length} ${pendingItems.length === 1 ? "ítem" : "ítems"}`
                      : `${grouped.length} ${grouped.length === 1 ? "producto" : "productos"}`}
                  </span>
                </div>
              )}
              {sector === "pendescanear" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingItems.map((item) => (
                    <Link
                      key={item.id}
                      to={`/purchases/${item.orderId}`}
                      className="silva-stock-product-card"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <span className="silva-stock-product-card__arrow" aria-hidden>
                        <ChevronRight size={16} />
                      </span>
                      <div className="silva-stock-product-card__body">
                        <div className="silva-stock-product-card__name">{item.modelLabel}</div>
                        <div className="silva-stock-product-card__variants">
                          Orden {item.orderNumber ?? item.orderId.slice(0, 8)}
                        </div>
                      </div>
                      <div className="silva-stock-product-card__qty">
                        <span className="silva-stock-product-card__qty-value">{item.pending}</span>
                        <span className="silva-stock-product-card__qty-label">por escanear</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {grouped.map((group) => (
                    <button
                      key={group.model}
                      type="button"
                      className="silva-stock-product-card"
                      style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer", font: "inherit" }}
                      onClick={() => {
                        setSelectedModelGroup(group);
                        setSelectedVariant(null);
                      }}
                    >
                      <span className="silva-stock-product-card__arrow" aria-hidden>
                        <ChevronRight size={16} />
                      </span>
                      <div className="silva-stock-product-card__body">
                        <div className="silva-stock-product-card__name">{group.model}</div>
                        <div className="silva-stock-product-card__variants">
                          {group.memories.length} {group.memories.length === 1 ? "memoria" : "memorias"}
                        </div>
                      </div>
                      <div className="silva-stock-product-card__qty">
                        <span className="silva-stock-product-card__qty-value">{group.total}</span>
                        <span className="silva-stock-product-card__qty-label">unidades</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {(mainSection === "sealed" || mainSection === "used" || user?.role !== "admin") && !selectedModelGroup && (sector === "pendescanear" ? pendingItems.length === 0 : grouped.length === 0) && (
        <Box>
          <p className="silva-helper">
            {sector === "pendescanear" ? "No hay ítems de órdenes de compra pendientes de escanear." : "No hay equipos en esta sección."}
          </p>
        </Box>
      )}

      {imeiScannerOpen && (
        <ImeiBarcodeScannerModal
          open={imeiScannerOpen}
          onClose={() => setImeiScannerOpen(false)}
          onScan={(digits) => {
            setTradeInForm((p) => ({ ...p, imei: digits }));
            setImeiScannerOpen(false);
          }}
        />
      )}

      {sendToTechDevice && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="send-to-tech-title">
          <div className="silva-modal" style={{ maxWidth: 440 }}>
            <h3 id="send-to-tech-title" className="silva-modal-title" style={{ margin: 0 }}>Enviar a técnico</h3>
            <p className="silva-helper" style={{ margin: "0.25rem 0 0.75rem" }}>
              IMEI: <span className="font-mono">{sendToTechDevice.imei}</span>
              {sendToTechDevice.model && ` · ${sendToTechDevice.model}`}
            </p>
            <label className="silva-label">Técnico *</label>
            <select
              className="silva-input"
              value={sendToTechTechnicianId}
              onChange={(e) => setSendToTechTechnicianId(e.target.value)}
              style={{ marginBottom: "0.75rem" }}
            >
              <option value="">Seleccionar</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
            <label className="silva-label">Motivo de reparación</label>
            <input
              className="silva-input"
              value={sendToTechReason}
              onChange={(e) => setSendToTechReason(e.target.value)}
              placeholder="Ej. pantalla rota, batería"
              style={{ marginBottom: "0.75rem" }}
            />
            <label className="silva-label">Anotaciones</label>
            <textarea
              className="silva-input"
              value={sendToTechNotes}
              onChange={(e) => setSendToTechNotes(e.target.value)}
              placeholder="Notas adicionales"
              rows={2}
              style={{ marginBottom: "0.75rem", resize: "vertical" }}
            />
            <label className="silva-label">Precio que nos cobra (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              className="silva-input"
              value={sendToTechPrice}
              onChange={(e) => setSendToTechPrice(e.target.value)}
              placeholder="Ej. 15000"
              style={{ marginBottom: "1rem" }}
            />
            {technicians.length === 0 && (
              <p className="silva-helper" style={{ marginBottom: "1rem", color: "var(--silva-warning)" }}>
                No hay técnicos cargados. Creá uno en Técnicos.
              </p>
            )}
            <div className="silva-modal-actions">
              <button
                type="button"
                className="silva-btn"
                onClick={() => { setSendToTechDevice(null); setSendToTechTechnicianId(""); setSendToTechReason(""); setSendToTechNotes(""); setSendToTechPrice(""); setError(null); }}
                disabled={sendToTechSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="silva-btn silva-btn-primary"
                onClick={sendDeviceToTechnician}
                disabled={sendToTechSaving || !sendToTechTechnicianId || technicians.length === 0}
              >
                {sendToTechSaving ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {returnPriceDevice && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="return-tech-title">
          <div className="silva-modal" style={{ maxWidth: 400 }}>
            <h3 id="return-tech-title" className="silva-modal-title" style={{ margin: 0 }}>Quitar de técnico</h3>
            <p className="silva-helper" style={{ margin: "0.25rem 0 0.75rem" }}>
              IMEI: <span className="font-mono">{returnPriceDevice.imei}</span>
            </p>
            <label className="silva-label">Precio que nos cobró (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              className="silva-input"
              value={returnPriceValue}
              onChange={(e) => setReturnPriceValue(e.target.value)}
              placeholder="Ej. 15000"
              style={{ marginBottom: "1rem" }}
            />
            <div className="silva-modal-actions">
              <button type="button" className="silva-btn" onClick={() => { setReturnPriceDevice(null); setReturnPriceValue(""); setError(null); }} disabled={returnSaving}>Cancelar</button>
              <button type="button" className="silva-btn silva-btn-primary" onClick={confirmReturnFromTechnician} disabled={returnSaving}>
                {returnSaving ? "Cerrando…" : "Cerrar reparación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRepairDevice && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-repair-title">
          <div className="silva-modal" style={{ maxWidth: 440 }}>
            <h3 id="edit-repair-title" className="silva-modal-title" style={{ margin: 0 }}>Editar reparación</h3>
            <p className="silva-helper" style={{ margin: "0.25rem 0 0.75rem" }}>
              IMEI: <span className="font-mono">{editRepairDevice.imei}</span>
            </p>
            <label className="silva-label">Motivo de reparación</label>
            <input
              className="silva-input"
              value={editRepairForm.reason}
              onChange={(e) => setEditRepairForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Ej. pantalla rota"
              style={{ marginBottom: "0.75rem" }}
            />
            <label className="silva-label">Anotaciones</label>
            <textarea
              className="silva-input"
              value={editRepairForm.notes}
              onChange={(e) => setEditRepairForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notas"
              rows={2}
              style={{ marginBottom: "0.75rem", resize: "vertical" }}
            />
            <label className="silva-label">Precio que nos cobra</label>
            <input
              type="text"
              inputMode="decimal"
              className="silva-input"
              value={editRepairForm.price}
              onChange={(e) => setEditRepairForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="Ej. 15000"
              style={{ marginBottom: "1rem" }}
            />
            <div className="silva-modal-actions">
              <button type="button" className="silva-btn" onClick={() => setEditRepairDevice(null)} disabled={editRepairSaving}>Cancelar</button>
              <button type="button" className="silva-btn silva-btn-primary" onClick={saveEditRepair} disabled={editRepairSaving}>{editRepairSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {repairHistoryDevice && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="repair-history-title">
          <div className="silva-modal" style={{ maxWidth: 560 }}>
            <h3 id="repair-history-title" className="silva-modal-title" style={{ margin: 0 }}>Historial de reparaciones</h3>
            <p className="silva-helper" style={{ margin: "0.25rem 0 0.75rem" }}>
              IMEI: <span className="font-mono">{repairHistoryDevice.imei}</span>
              {repairHistoryDevice.model && ` · ${repairHistoryDevice.model}`}
            </p>
            <div className="silva-table-wrap" style={{ marginBottom: "1rem" }}>
              <table className="silva-table">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>Motivo</th>
                    <th>Anotaciones</th>
                    <th>Precio</th>
                    <th>Envío</th>
                    <th>Devolución</th>
                  </tr>
                </thead>
                <tbody>
                  {repairHistoryRecords.map((r) => (
                    <tr key={r.id}>
                      <td>{r.technician.name}</td>
                      <td>{r.reason ?? "—"}</td>
                      <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{r.notes ?? "—"}</td>
                      <td>{r.priceCents != null ? (r.priceCents / 100).toLocaleString("es-AR") : "—"}</td>
                      <td>{new Date(r.sentAt).toLocaleDateString("es-AR")}</td>
                      <td>{r.returnedAt ? new Date(r.returnedAt).toLocaleDateString("es-AR") : "En curso"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {repairHistoryRecords.length === 0 && (
              <p className="silva-helper" style={{ marginBottom: "1rem" }}>Sin reparaciones registradas para este equipo.</p>
            )}
            <button type="button" className="silva-btn" onClick={() => setRepairHistoryDevice(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {requestModalOpen && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-label="Solicitar producto sin stock">
          <div className="silva-modal">
            <h3 className="silva-modal-title">Solicitud sin stock</h3>
            <p className="silva-helper">Quedará pendiente de aprobación y notificará al admin.</p>
            <form onSubmit={submitStockRequest}>
              <label className="silva-label">Variante del catálogo (opcional)</label>
              <select
                className="silva-select"
                value={requestForm.variantId}
                onChange={(e) => {
                  const value = e.target.value;
                  const selectedVariant = catalog
                    .flatMap((c) => c.offers)
                    .flatMap((o) => o.variants.map((v) => ({ ...v, offerName: o.name })))
                    .find((v) => v.id === value);
                  setRequestForm((p) => ({
                    ...p,
                    variantId: value,
                    title: selectedVariant ? `${selectedVariant.offerName} - ${selectedVariant.label}` : p.title
                  }));
                }}
              >
                <option value="">Seleccionar variante</option>
                {catalog.flatMap((c) =>
                  c.offers.flatMap((o) =>
                    o.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {c.name} / {o.name} / {v.label}
                      </option>
                    ))
                  )
                )}
              </select>
              <label className="silva-label" style={{ marginTop: 8 }}>Título</label>
              <input
                className="silva-input"
                value={requestForm.title}
                onChange={(e) => setRequestForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ej: iPhone 16 Pro Max 256 GB"
              />
              <label className="silva-label" style={{ marginTop: 8 }}>Cantidad</label>
              <input
                className="silva-input"
                type="number"
                min="1"
                value={requestForm.quantity}
                onChange={(e) => setRequestForm((p) => ({ ...p, quantity: e.target.value }))}
              />
              <label className="silva-label" style={{ marginTop: 8 }}>Nota</label>
              <input
                className="silva-input"
                value={requestForm.note}
                onChange={(e) => setRequestForm((p) => ({ ...p, note: e.target.value }))}
              />
              {requestError && <div className="silva-alert" style={{ marginTop: 8 }}>{requestError}</div>}
              <div className="silva-modal-actions">
                <button type="button" className="silva-btn" onClick={() => setRequestModalOpen(false)} disabled={requestLoading}>
                  Cancelar
                </button>
                <button type="submit" className="silva-btn silva-btn-primary" disabled={requestLoading}>
                  {requestLoading ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
