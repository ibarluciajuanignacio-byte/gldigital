import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { LordIcon, type LordIconName } from "../components/LordIcon";
import { useDarkMode } from "../hooks/useDarkMode";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, MessageCircle } from "lucide-react";

type DashboardCharts = {
  devicesByState?: Record<string, number>;
  consignmentsByStatus?: Record<string, number>;
  paymentsByStatus?: Record<string, number>;
  debtByReseller?: { resellerId?: string; resellerName: string; balanceCents: number }[];
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

/** Item de alerta: mock tiene resellerName, amountUsd, daysOwing; con datos reales puede incluir resellerId */
type DebtAlertItem = { resellerName: string; amountUsd: number; daysOwing: number; resellerId?: string };

/** Datos inventados para dar forma a la tarjeta de alertas de deuda (luego conectar con datos reales) */
const MOCK_DEBT_ALERTS: DebtAlertItem[] = [
  { resellerName: "Revendedor 1", amountUsd: 750, daysOwing: 45 },
  { resellerName: "Revendedor 2", amountUsd: 500, daysOwing: 7 },
  { resellerName: "Revendedor 3", amountUsd: 320, daysOwing: 15 },
  { resellerName: "Revendedor 4", amountUsd: 180, daysOwing: 60 },
  { resellerName: "Revendedor 5", amountUsd: 90, daysOwing: 3 }
];

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
  const [liveDollar, setLiveDollar] = useState<LiveDollarOfficial | null>(null);
  const [dollarBarExpanded, setDollarBarExpanded] = useState(false);
  const [isDarkMode] = useDarkMode();
  const [selectedDebtAlertIndex, setSelectedDebtAlertIndex] = useState<number | null>(null);
  const kpiScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get("/dashboard")
      .then((res) => {
        setKpis(res.data.kpis ?? {});
        setCharts(res.data.charts ?? {});
      })
      .catch(() => {
        setKpis({});
        setCharts({});
      });
  }, []);

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
  const items: Array<{ key: string; label: string; lordIcon: LordIconName; to: string }> = isAdmin
    ? [
        { key: "devices", label: "Equipos", lordIcon: "stock", to: "/inventory" },
        { key: "resellers", label: "Revendedores", lordIcon: "resellers", to: "/resellers" },
        { key: "consignments", label: "Consignaciones", lordIcon: "coonsignacion", to: "/consignments" },
        { key: "paymentsPending", label: "Pagos pendientes", lordIcon: "caja", to: "/payments" },
        { key: "totalDebtCents", label: "Deuda total (USD)", lordIcon: "deuda", to: "/debts" }
      ]
    : [
        { key: "devices", label: "Equipos", lordIcon: "stock", to: "/inventory" },
        { key: "paymentsPending", label: "Pagos pendientes", lordIcon: "caja", to: "/payments" },
        { key: "debtCents", label: "Mi deuda (USD)", lordIcon: "deuda", to: "/debts" }
      ];
  /* Duplicado para slider infinito: al llegar al final se resetea a 0 */
  const itemsForCarousel = [...items, ...items];

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
  const debtAlertsDisplay: DebtAlertItem[] =
    topFiveDebts.length > 0
      ? topFiveDebts.map((b) => ({
          resellerName: b.resellerName,
          amountUsd: b.balanceCents / 100,
          daysOwing: 0,
          resellerId: b.resellerId
        }))
      : MOCK_DEBT_ALERTS;

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

      <div className="silva-home-kpi-slider-wrap">
        <div
          ref={kpiScrollRef}
          className="silva-home-kpi-row silva-home-kpi-row--scroll"
          role="region"
          aria-label="KPIs"
        >
          {itemsForCarousel.map(({ key, label, lordIcon, to }, i) => (
            <div key={`${key}-${i}`} className="silva-home-kpi-slide">
              <button
                type="button"
                className="silva-home-kpi-card silva-home-kpi-card--clickable"
                onClick={() => navigate(to)}
              >
                <div className="silva-home-kpi-card__icon">
                  <LordIcon name={lordIcon} size={24} />
                </div>
                <div className="silva-home-kpi-card__value">
                  {key.includes("Cents") && typeof kpis[key] === "number"
                    ? ((kpis[key] as number) / 100).toFixed(2)
                    : (kpis[key] ?? 0)}
                </div>
                <div className="silva-home-kpi-card__label">{label}</div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <Box className={`silva-home-section silva-home-debt-alerts ${isDarkMode ? "silva-home-debt-alerts--dark" : ""}`} role="region" aria-label="Alertas de deuda">
          <div className="silva-home-section__head">
            <h2 className="silva-home-section__title silva-home-debt-alerts__title">
              <AlertTriangle size={22} className="silva-home-debt-alerts__icon" aria-hidden />
              Alertas de deuda
            </h2>
            <button type="button" onClick={() => navigate("/debts")} className="silva-home-debt-alerts__cta">
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
