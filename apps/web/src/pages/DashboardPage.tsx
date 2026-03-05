import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { LordIcon } from "../components/LordIcon";
import { useDarkMode } from "../hooks/useDarkMode";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, MessageCircle, ClipboardList, CheckCircle, History, Pencil, Trash2, Plus } from "lucide-react";

type DashboardCharts = {
  devicesByState?: Record<string, number>;
  consignmentsByStatus?: Record<string, number>;
  paymentsByStatus?: Record<string, number>;
  debtByReseller?: { resellerId?: string; resellerName: string; balanceCents: number; daysOwing?: number }[];
};

type PendingStockRequest = {
  id: string;
  resellerId?: string;
  title: string;
  note?: string | null;
  resellerName: string;
  createdAt: string;
  quantity: number;
};

type LiveDollarOfficial = {
  buy: number | null;
  sell: number | null;
  reference: number | null;
  blueBuy: number | null;
  blueSell: number | null;
  blueReference: number | null;
  updatedAgo: string | null;
  source: string;
  sourceLogoUrl: string;
  providerDate: string | null;
  verified: boolean;
  fetchedAt: string;
  stale?: boolean;
};

const STATE_LABELS: Record<string, string> = {
  available: "Disponibles",
  consigned: "Consignados",
  sold: "Vendidos",
  returned: "Devueltos",
  active: "Activas",
  sold_status: "Vendidas"
};

const PAYMENT_LABELS: Record<string, string> = {
  reported_pending: "Pendientes",
  confirmed: "Confirmados",
  rejected: "Rechazados"
};

/** Item de alerta de deuda (datos del dashboard) */
type DebtAlertItem = { resellerName: string; amountUsd: number; daysOwing: number; resellerId?: string };

function debtAlertTrafficLight(daysOwing: number): "red" | "yellow" | "green" {
  if (daysOwing >= 30) return "red";
  if (daysOwing >= 8) return "yellow";
  return "green";
}

/** Datos de ejemplo para mostrar el gráfico cuando no hay stock cargado (solo visual) */
const FAKE_STOCK_CHART_DATA = [
  { key: "available", name: "Disponibles", value: 42 },
  { key: "consigned", name: "Consignados", value: 28 },
  { key: "sold", name: "Vendidos", value: 19 },
  { key: "returned", name: "Devueltos", value: 6 }
];

function objectToChartData(obj: Record<string, number>, labelMap: Record<string, string>) {
  return Object.entries(obj).map(([key, value]) => ({ key, name: labelMap[key] ?? key, value }));
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [charts, setCharts] = useState<DashboardCharts>({});
  const [pendingStockRequests, setPendingStockRequests] = useState<PendingStockRequest[]>([]);
  const [liveDollar, setLiveDollar] = useState<LiveDollarOfficial | null>(null);
  const [dollarBarExpanded, setDollarBarExpanded] = useState(false);
  const [isDarkMode] = useDarkMode();
  const [selectedDebtAlertIndex, setSelectedDebtAlertIndex] = useState<number | null>(null);
  const [completeConfirmRequest, setCompleteConfirmRequest] = useState<PendingStockRequest | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<PendingStockRequest | null>(null);
  const [editResellerName, setEditResellerName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmRequest, setDeleteConfirmRequest] = useState<PendingStockRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredHechoId, setHoveredHechoId] = useState<string | null>(null);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [addTaskResellerId, setAddTaskResellerId] = useState("");
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskNote, setAddTaskNote] = useState("");
  const [addTaskQuantity, setAddTaskQuantity] = useState(1);
  const [addTaskSubmitting, setAddTaskSubmitting] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [addTaskResellers, setAddTaskResellers] = useState<Array<{ id: string; name: string }>>([]);

  function refreshDashboard() {
    api.get("/dashboard").then((res) => {
      setKpis(res.data.kpis ?? {});
      setCharts(res.data.charts ?? {});
      setPendingStockRequests(res.data.pendingStockRequests ?? []);
    }).catch(() => {});
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  async function confirmMarkCompleted() {
    if (!completeConfirmRequest) return;
    const id = completeConfirmRequest.id;
    setCompletingId(id);
    try {
      await api.post(`/stock/requests/${id}/status`, {
        status: "completed",
        resolvedNote: completionNote.trim() || undefined
      });
      setPendingStockRequests((prev) => prev.filter((r) => r.id !== id));
      setCompleteConfirmRequest(null);
      setCompletionNote("");
    } finally {
      setCompletingId(null);
    }
  }

  function openCompleteModal(req: PendingStockRequest) {
    setCompleteConfirmRequest(req);
    setCompletionNote("");
  }

  function closeCompleteModal() {
    if (!completingId) {
      setCompleteConfirmRequest(null);
      setCompletionNote("");
    }
  }

  function openEditModal(req: PendingStockRequest) {
    setEditRequest(req);
    setEditResellerName(req.resellerName ?? "");
    setEditTitle(req.title);
    const noteRaw = req.note ?? "";
    const isRedundantNote = noteRaw.trim() && (
      noteRaw.trim() === `${req.resellerName}: ${req.title}`.trim() ||
      noteRaw.trim().startsWith(`${req.resellerName}: `)
    );
    setEditNote(isRedundantNote ? "" : noteRaw);
    setEditQuantity(req.quantity);
  }

  function closeEditModal() {
    if (!savingEdit) {
      setEditRequest(null);
    }
  }

  async function saveEdit() {
    if (!editRequest) return;
    setSavingEdit(true);
    try {
      const { data } = await api.patch<{ request: PendingStockRequest & { note?: string | null; reseller?: { user: { name: string } } } }>(
        `/stock/requests/${editRequest.id}`,
        { resellerName: editResellerName.trim(), title: editTitle.trim(), note: editNote.trim() || null, quantity: editQuantity }
      );
      const newName = data.request.reseller?.user?.name ?? editResellerName.trim();
      setPendingStockRequests((prev) =>
        prev.map((r) => (r.id === editRequest.id ? { ...r, resellerName: newName, title: data.request.title, note: data.request.note ?? null, quantity: data.request.quantity } : r))
      );
      setEditRequest(null);
    } finally {
      setSavingEdit(false);
    }
  }

  function openDeleteModal(req: PendingStockRequest) {
    setDeleteConfirmRequest(req);
  }

  function closeDeleteModal() {
    if (!deletingId) setDeleteConfirmRequest(null);
  }

  async function confirmDelete() {
    if (!deleteConfirmRequest) return;
    const id = deleteConfirmRequest.id;
    setDeletingId(id);
    try {
      await api.post(`/stock/requests/${id}/status`, { status: "cancelled" });
      setPendingStockRequests((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmRequest(null);
    } finally {
      setDeletingId(null);
    }
  }

  function openAddTaskModal() {
    setAddTaskError(null);
    setAddTaskResellerId("");
    setAddTaskTitle("");
    setAddTaskNote("");
    setAddTaskQuantity(1);
    setAddTaskModalOpen(true);
    api.get<{ resellers: Array<{ id: string; user: { name: string } }> }>("/resellers", { params: { pageSize: 200 } })
      .then((res) => setAddTaskResellers((res.data.resellers ?? []).map((r) => ({ id: r.id, name: r.user.name }))))
      .catch(() => setAddTaskResellers([]));
  }

  function closeAddTaskModal() {
    if (!addTaskSubmitting) setAddTaskModalOpen(false);
  }

  async function submitAddTask() {
    if (!addTaskResellerId || !addTaskTitle.trim()) return;
    setAddTaskError(null);
    setAddTaskSubmitting(true);
    try {
      const { data } = await api.post<{ request: PendingStockRequest & { reseller?: { user: { name: string } } } }>("/stock/requests", {
        resellerId: addTaskResellerId,
        title: addTaskTitle.trim(),
        note: addTaskNote.trim() || undefined,
        quantity: addTaskQuantity
      });
      const resellerName = data.request.reseller?.user?.name ?? addTaskResellers.find((r) => r.id === addTaskResellerId)?.name ?? "";
      setPendingStockRequests((prev) => [{
        id: data.request.id,
        resellerId: data.request.resellerId ?? addTaskResellerId,
        title: data.request.title,
        note: data.request.note ?? null,
        resellerName,
        createdAt: new Date().toISOString(),
        quantity: data.request.quantity
      }, ...prev]);
      setAddTaskModalOpen(false);
    } catch (err: unknown) {
      const res = err && typeof err === "object" && "response" in err ? (err as { response?: { data?: { message?: string } } }).response : undefined;
      setAddTaskError(res?.data?.message ?? "No se pudo crear la tarea.");
    } finally {
      setAddTaskSubmitting(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    const loadDollar = async () => {
      try {
        const res = await api.get("/dashboard/dollar-live");
        if (isMounted) {
          setLiveDollar(res.data ?? null);
        }
      } catch (error) {
        console.error("No se pudo cargar cotización dólar en vivo", error);
      }
    };
    void loadDollar();
    const intervalId = window.setInterval(loadDollar, 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const isAdmin = "totalDebtCents" in kpis || "consignments" in kpis;

  const devicesByStateData = useMemo(
    () =>
      charts.devicesByState
        ? objectToChartData(charts.devicesByState, STATE_LABELS).filter((d) => d.value > 0)
        : [],
    [charts.devicesByState]
  );
  const paymentsByStatusData = charts.paymentsByStatus
    ? objectToChartData(charts.paymentsByStatus, PAYMENT_LABELS).filter((d) => d.value > 0)
    : [];
  const debtByResellerData = charts.debtByReseller ?? [];
  const topFiveDebts = debtByResellerData.slice(0, 5);
  const debtAlertsDisplay: DebtAlertItem[] = (
    topFiveDebts.length > 0
      ? topFiveDebts.map((b) => ({
          resellerName: b.resellerName,
          amountUsd: b.balanceCents / 100,
          daysOwing: b.daysOwing ?? 0,
          resellerId: b.resellerId
        }))
      : []
  ).sort((a, b) => b.daysOwing - a.daysOwing);

  const formatArs = (value: number | null | undefined) =>
    typeof value === "number"
      ? value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "--";

  async function handleSendMessageToReseller(item: DebtAlertItem) {
    const daysText =
      item.daysOwing === 0 ? "" : item.daysOwing === 1 ? " (hace 1 día)" : ` (hace ${item.daysOwing} días)`;
    const draftMessage = `Hola ${item.resellerName}, te escribimos por tu deuda de ${item.amountUsd.toFixed(2)} USD${daysText}. Te pedimos regularizar la deuda cuando puedas.`;
    if (item.resellerId) {
      try {
        const { data } = await api.get(`/resellers/${item.resellerId}/profile`);
        let conversationId = data?.chat?.dmConversationId ?? null;
        if (!conversationId) {
          const res = await api.post(`/chat/dm/by-reseller/${item.resellerId}`);
          conversationId = res.data.conversationId as string;
        }
        navigate(`/chat?conversationId=${encodeURIComponent(conversationId)}`, { state: { draftMessage } });
      } catch {
        navigate("/chat", { state: { draftMessage } });
      }
    } else {
      navigate("/chat", { state: { draftMessage } });
    }
  }

  return (
    <div className="silva-home">
      <div
        className={`silva-home-info-bar ${dollarBarExpanded ? "is-expanded" : "is-retracted"}`}
        role="region"
        aria-label="Dólar en vivo"
        aria-expanded={dollarBarExpanded}
      >
        <button
          type="button"
          className="silva-home-info-bar__head"
          onClick={() => setDollarBarExpanded((v) => !v)}
          aria-expanded={dollarBarExpanded}
          aria-label={dollarBarExpanded ? "Contraer cotizaciones" : "Desplegar cotizaciones"}
        >
          {liveDollar?.sourceLogoUrl ? (
            <a
              href="https://dolarhoy.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="silva-home-info-bar__source silva-home-info-bar__source--head"
              aria-label="DolarHoy"
              title="Ir a DolarHoy"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={liveDollar.sourceLogoUrl} alt="DolarHoy - Dólar en vivo" loading="lazy" />
            </a>
          ) : (
            <span className="silva-home-info-bar__title">Dólar en vivo</span>
          )}
          {dollarBarExpanded ? (
            <ChevronUp size={20} className="silva-home-info-bar__chevron" aria-hidden />
          ) : (
            <ChevronDown size={20} className="silva-home-info-bar__chevron" aria-hidden />
          )}
        </button>
        <div className="silva-home-info-bar__body">
          <div className="silva-home-info-bar__rates">
            <div className="silva-home-info-bar__rate-group">
              <span className="silva-home-hero__badge-official">Oficial</span>
              <span className="silva-home-info-bar__value">${formatArs(liveDollar?.buy)} / ${formatArs(liveDollar?.sell)}</span>
            </div>
            <div className="silva-home-info-bar__rate-group">
              <span className="silva-home-hero__badge-blue">Blue</span>
              <span className="silva-home-info-bar__value">${formatArs(liveDollar?.blueBuy)} / ${formatArs(liveDollar?.blueSell)}</span>
            </div>
            <div className="silva-home-info-bar__rate-group">
              <span className="silva-home-hero__badge-blue">Blue + $20</span>
              <span className="silva-home-info-bar__value">${formatArs(liveDollar?.blueSell != null ? liveDollar.blueSell + 20 : null)}</span>
            </div>
          </div>
          <div className="silva-home-info-bar__footer">
            <span className="silva-home-info-bar__meta">
              {liveDollar?.updatedAgo ? `Actualizado hace ${liveDollar.updatedAgo}` : "Sin actualización"}
              {liveDollar?.verified ? " · Verificado" : ""}
            </span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <Box className={`silva-home-section silva-home-debt-alerts ${isDarkMode ? "silva-home-debt-alerts--dark" : ""}`} role="region" aria-label="Alertas de deuda">
          <div className="silva-home-section__head">
            <h2 className="silva-home-section__title silva-home-debt-alerts__title">
              <AlertTriangle size={22} className="silva-home-debt-alerts__icon" aria-hidden />
              Alertas de deuda
            </h2>
            <button type="button" onClick={() => navigate("/debts")} className="silva-btn silva-home-debt-alerts__cta">
              Ver Deuda viva
            </button>
          </div>
          <p className="silva-home-debt-alerts__intro">Quién nos debe y hace cuánto tiempo.</p>
          {debtAlertsDisplay.length > 0 ? (
            <ul className="silva-home-debt-alerts__list">
              {debtAlertsDisplay.map((item, index) => {
                const light = debtAlertTrafficLight(item.daysOwing);
                const isSelected = selectedDebtAlertIndex === index;
                return (
                  <li key={item.resellerName + index}>
                    <button
                      type="button"
                      className={`silva-home-debt-alerts__item ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedDebtAlertIndex((i) => (i === index ? null : index))}
                      aria-pressed={isSelected}
                      aria-label={`${item.resellerName}, debe ${item.amountUsd.toFixed(2)} USD. ${isSelected ? "Mostrar opción para enviar mensaje" : "Seleccionar para enviar mensaje"}`}
                    >
                      <span className={`silva-home-debt-alerts__light silva-home-debt-alerts__light--${light}`} title={light === "red" ? "Hace 30+ días" : light === "yellow" ? "Hace 8–29 días" : "Hace menos de 8 días"} aria-hidden />
                      <div className="silva-home-debt-alerts__body">
                        <span className="silva-home-debt-alerts__name">{item.resellerName}</span>
                        <span className="silva-home-debt-alerts__meta">
                          Debe {item.amountUsd.toFixed(2)} USD
                          {item.daysOwing > 0 && ` · hace ${item.daysOwing} ${item.daysOwing === 1 ? "día" : "días"}`}
                        </span>
                      </div>
                      <strong className="silva-home-debt-alerts__amount">{item.amountUsd.toFixed(2)} USD</strong>
                    </button>
                    {isSelected && (
                      <div className="silva-home-debt-alerts__float-wrap">
                        <button
                          type="button"
                          className="silva-home-debt-alerts__float-btn"
                          onClick={() => handleSendMessageToReseller(item)}
                        >
                          <MessageCircle size={18} aria-hidden />
                          Enviar mensaje a {item.resellerName}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="silva-helper silva-home-debt-alerts__empty">Sin deudas pendientes.</p>
          )}
        </Box>
      )}

      {isAdmin && (
        <Box className={`silva-home-section silva-home-debt-alerts ${isDarkMode ? "silva-home-debt-alerts--dark" : ""}`} role="region" aria-label="Tareas pendientes">
          <div className="silva-home-section__head">
            <h2 className="silva-home-section__title silva-home-debt-alerts__title">
              <ClipboardList size={22} className="silva-home-debt-alerts__icon" aria-hidden />
              Tareas pendientes
            </h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={openAddTaskModal} className="silva-btn silva-btn-primary" style={{ padding: "6px 14px", fontSize: "0.9rem" }} title="Agregar tarea">
                <Plus size={18} aria-hidden style={{ verticalAlign: "middle", marginRight: 4 }} />
                Agregar
              </button>
              <button type="button" onClick={() => navigate("/notes/tasks-history")} className="silva-btn silva-home-debt-alerts__cta" style={{ padding: "6px 14px", fontSize: "0.9rem" }}>
                <History size={16} aria-hidden style={{ verticalAlign: "middle", marginRight: 4 }} />
                Ver historial
              </button>
            </div>
          </div>
          <p className="silva-home-debt-alerts__intro">Marcá como realizada cuando la tarea esté hecha; queda registrada con fecha de creación y de cierre.</p>
          {pendingStockRequests.length === 0 ? (
            <p className="silva-helper silva-home-debt-alerts__empty">Sin tareas pendientes.</p>
          ) : (
            <ul className="silva-home-debt-alerts__list">
              {pendingStockRequests.slice(0, 8).map((req) => {
                const daysPending = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / 86_400_000);
                const light = daysPending >= 30 ? "red" : daysPending >= 8 ? "yellow" : "green";
                return (
                  <li key={req.id}>
                    <div className="silva-home-debt-alerts__item" style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 8 }}>
                      <span
                        className={`silva-home-debt-alerts__light silva-home-debt-alerts__light--${light}`}
                        title={
                          light === "red" ? "Pendiente hace 30+ días" : light === "yellow" ? "Pendiente hace 8–29 días" : "Pendiente hace menos de 8 días"
                        }
                        aria-hidden
                      />
                      <button
                        type="button"
                        className="silva-home-debt-alerts__body"
                        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); openEditModal(req); }}
                      >
                        <span className="silva-home-debt-alerts__name">{req.resellerName}</span>
                        <span className="silva-home-debt-alerts__meta">
                          {req.title}
                          {req.quantity > 1 ? ` × ${req.quantity}` : ""}
                          {daysPending > 0 && ` · hace ${daysPending} ${daysPending === 1 ? "día" : "días"}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="silva-btn silva-btn-primary"
                        style={{
                          padding: "8px 14px",
                          fontSize: "0.85rem",
                          flexShrink: 0,
                          fontWeight: 600,
                          borderColor: "var(--silva-primary)",
                          background: hoveredHechoId === req.id
                            ? "linear-gradient(165deg, rgba(50, 110, 140, 0.98) 0%, rgba(2, 38, 58, 0.98) 45%, rgba(0, 30, 50, 0.98) 100%)"
                            : "linear-gradient(165deg, rgba(80, 140, 170, 0.98) 0%, var(--silva-primary) 45%, rgba(2, 45, 70, 0.98) 100%)",
                          boxShadow: hoveredHechoId === req.id
                            ? "inset 0 2px 6px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.1)"
                            : "0 3px 10px rgba(255, 255, 255, 0.2) inset, 0 1px 3px rgba(0, 0, 0, 0.12)",
                          transform: hoveredHechoId === req.id ? "translateY(1px)" : undefined
                        }}
                        onMouseEnter={() => setHoveredHechoId(req.id)}
                        onMouseLeave={() => setHoveredHechoId(null)}
                        onClick={(e) => { e.stopPropagation(); openCompleteModal(req); }}
                        title="Hecho"
                        aria-label={`Hecho: ${req.title}`}
                      >
                        <CheckCircle size={18} aria-hidden style={{ marginRight: 6, verticalAlign: "middle" }} />
                        Hecho
                      </button>
                      <span style={{ flexShrink: 0, cursor: "pointer", padding: 4 }} onClick={(e) => { e.stopPropagation(); openEditModal(req); }} title="Editar" aria-hidden><ArrowRight size={18} className="silva-home-debt-alerts__amount" /></span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, marginLeft: 4 }}>
                        <button
                          type="button"
                          className="silva-btn"
                          style={{
                            padding: "4px 6px",
                            minWidth: 0,
                            fontSize: "0.75rem",
                            color: "var(--silva-muted)",
                            borderColor: "var(--silva-border)"
                          }}
                          onClick={(e) => { e.stopPropagation(); openEditModal(req); }}
                          title="Editar tarea"
                          aria-label={`Editar: ${req.title}`}
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="silva-btn"
                          style={{
                            padding: "4px 6px",
                            minWidth: 0,
                            fontSize: "0.75rem",
                            color: "var(--silva-muted)",
                            borderColor: "var(--silva-border)"
                          }}
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(req); }}
                          title="Eliminar tarea"
                          aria-label={`Eliminar: ${req.title}`}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Box>
      )}

      {completeConfirmRequest && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-task-title" onClick={closeCompleteModal}>
          <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 id="complete-task-title" className="silva-modal-title">¿Realizaste esta tarea?</h3>
            <p className="silva-modal-subtitle">
              <strong>{completeConfirmRequest.resellerName}</strong>: {completeConfirmRequest.title}
              {completeConfirmRequest.quantity > 1 ? ` × ${completeConfirmRequest.quantity}` : ""}
            </p>
            <p className="silva-helper" style={{ marginTop: 8 }}>La tarea saldrá del listado y quedará en el historial con fecha de creación y de cierre.</p>
            <label className="silva-label" style={{ display: "block", marginTop: 14 }}>
              Notas o aclaración (opcional)
            </label>
            <textarea
              className="silva-input"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Ej: enviado por envío a Chaco, entregado en mano..."
              rows={3}
              style={{ width: "100%", resize: "vertical", marginTop: 4 }}
              disabled={!!completingId}
              aria-describedby="complete-note-helper"
            />
            <p id="complete-note-helper" className="silva-helper" style={{ marginTop: 4 }}>
              Esta nota queda registrada en el historial de la tarea.
            </p>
            <div className="silva-modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="silva-btn" onClick={closeCompleteModal} disabled={!!completingId}>
                Cancelar
              </button>
              <button type="button" className="silva-btn silva-btn-primary" onClick={confirmMarkCompleted} disabled={!!completingId}>
                {completingId ? "Guardando…" : "Sí, ya está realizada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRequest && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-task-title" onClick={closeEditModal}>
          <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 id="edit-task-title" className="silva-modal-title">Editar tarea</h3>

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
                placeholder="Ej: iphone 16 pro sellado clienta 50.000 pesos"
                style={{ width: "100%", marginTop: 4 }}
                disabled={savingEdit}
              />
            </section>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>3. Notas</label>
              <textarea
                className="silva-input"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Notas adicionales (opcional)"
                rows={2}
                style={{ width: "100%", resize: "vertical", marginTop: 4 }}
                disabled={savingEdit}
              />
            </section>

            <div className="silva-modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="silva-btn" onClick={closeEditModal} disabled={savingEdit}>
                Cancelar
              </button>
              <button type="button" className="silva-btn silva-btn-primary" onClick={saveEdit} disabled={savingEdit || !editResellerName.trim() || !editTitle.trim()}>
                {savingEdit ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmRequest && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-task-title" onClick={closeDeleteModal}>
          <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-task-title" className="silva-modal-title">¿Eliminar esta tarea?</h3>
            <p className="silva-modal-subtitle">
              <strong>{deleteConfirmRequest.resellerName}</strong>: {deleteConfirmRequest.title}
              {deleteConfirmRequest.quantity > 1 ? ` × ${deleteConfirmRequest.quantity}` : ""}
            </p>
            <p className="silva-helper" style={{ marginTop: 8 }}>Se quitará del listado de pendientes. Esta acción no se puede deshacer.</p>
            <div className="silva-modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="silva-btn" onClick={closeDeleteModal} disabled={!!deletingId}>
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

      {addTaskModalOpen && (
        <div className="silva-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-task-modal-title" onClick={closeAddTaskModal}>
          <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-task-modal-title" className="silva-modal-title">Agregar tarea</h3>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>Revendedor / persona</label>
              <select
                className="silva-input"
                value={addTaskResellerId}
                onChange={(e) => setAddTaskResellerId(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
                disabled={addTaskSubmitting}
              >
                <option value="">Seleccionar…</option>
                {addTaskResellers.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </section>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>Descripción</label>
              <input
                type="text"
                className="silva-input"
                value={addTaskTitle}
                onChange={(e) => setAddTaskTitle(e.target.value)}
                placeholder="Ej: consultar envío a Chaco, iphone 16 pro..."
                style={{ width: "100%", marginTop: 4 }}
                disabled={addTaskSubmitting}
              />
            </section>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>Cantidad</label>
              <input
                type="number"
                min={1}
                max={500}
                className="silva-input"
                value={addTaskQuantity}
                onChange={(e) => setAddTaskQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ width: "100%", marginTop: 4 }}
                disabled={addTaskSubmitting}
              />
            </section>

            <section style={{ marginTop: 16 }}>
              <label className="silva-label" style={{ display: "block", marginBottom: 4 }}>Notas (opcional)</label>
              <textarea
                className="silva-input"
                value={addTaskNote}
                onChange={(e) => setAddTaskNote(e.target.value)}
                placeholder="Notas adicionales"
                rows={2}
                style={{ width: "100%", resize: "vertical", marginTop: 4 }}
                disabled={addTaskSubmitting}
              />
            </section>

            {addTaskError && <div className="silva-alert" role="alert" style={{ marginTop: 12 }}>{addTaskError}</div>}

            <div className="silva-modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="silva-btn" onClick={closeAddTaskModal} disabled={addTaskSubmitting}>
                Cancelar
              </button>
              <button
                type="button"
                className="silva-btn silva-btn-primary"
                onClick={submitAddTask}
                disabled={addTaskSubmitting || !addTaskResellerId || !addTaskTitle.trim()}
              >
                {addTaskSubmitting ? "Guardando…" : "Agregar tarea"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="silva-home-quick-row">
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/inventory")}>
          <LordIcon name="stock" size={16} />
          <span>Stock</span>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/payments")}>
          <LordIcon name="caja" size={16} />
          <span>Pagos</span>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/debts")}>
          <LordIcon name="deuda" size={16} />
          <span>Deuda</span>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/consignments")}>
          <LordIcon name="coonsignacion" size={16} />
          <span>Consignaciones</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="silva-home-grid">
        {isAdmin && (() => {
          const chartData = devicesByStateData.length > 0 ? devicesByStateData : FAKE_STOCK_CHART_DATA;
          const chartTotal = chartData.reduce((acc, d) => acc + d.value, 0);
          const darkColors = ["#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#0c4a6e"];
          const lightColors = ["#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"];
          const segmentColors = isDarkMode ? darkColors : lightColors;
          return (
            <Box className={`silva-home-section silva-home-chart-wrap ${isDarkMode ? "silva-home-chart-wrap--dark" : ""}`}>
              <div className="silva-home-section__head">
                <h3>Estado de stock</h3>
                <span>{chartTotal} equipos</span>
              </div>
              <div className="silva-home-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={segmentColors[index % 6]}
                          stroke={isDarkMode ? "#1e293b" : "#fff"}
                          strokeWidth={1.5}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        const v = typeof value === "number" ? value : 0;
                        const pct = chartTotal > 0 ? ((v / chartTotal) * 100).toFixed(0) : "0";
                        return [`${v} (${pct}%)`, name ?? ""];
                      }}
                      contentStyle={{
                        background: isDarkMode ? "#252525" : "#fff",
                        border: isDarkMode ? "1px solid #2e2e2e" : "1px solid var(--silva-border)",
                        borderRadius: "10px",
                        fontSize: "12px"
                      }}
                      labelStyle={{ color: isDarkMode ? "#e4e5e7" : "var(--silva-text)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="silva-home-stock-legend" aria-label="Leyenda estado de stock">
                  {chartData.map((d, index) => {
                    const pct = chartTotal > 0 ? ((d.value / chartTotal) * 100).toFixed(0) : "0";
                    return (
                      <li key={d.key} className="silva-home-stock-legend__item">
                        <span
                          className="silva-home-stock-legend__swatch"
                          style={{ backgroundColor: segmentColors[index % 6] }}
                          aria-hidden
                        />
                        <span className="silva-home-stock-legend__name">{d.name}</span>
                        <span className="silva-home-stock-legend__pct">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Box>
          );
        })()}

        <Box className="silva-home-section">
          <div className="silva-home-section__head">
            <h3>Pagos</h3>
            <button type="button" onClick={() => navigate("/payments")}>
              Ver todo
            </button>
          </div>
          {paymentsByStatusData.length ? (
            <div className="silva-home-chip-grid">
              {paymentsByStatusData.map((item) => (
                <div key={item.key} className="silva-home-chip">
                  <span>{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="silva-helper">Sin pagos para mostrar.</p>
          )}
        </Box>

      </div>
    </div>
  );
}
