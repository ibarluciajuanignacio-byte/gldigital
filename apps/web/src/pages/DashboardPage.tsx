import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Banknote, ChevronDown, ChevronUp, Package, Truck, Users, Wallet } from "lucide-react";

type DashboardCharts = {
  devicesByState?: Record<string, number>;
  consignmentsByStatus?: Record<string, number>;
  paymentsByStatus?: Record<string, number>;
  debtByReseller?: { resellerName: string; balanceCents: number }[];
};

type UpcomingBirthday = {
  kind: "reseller" | "client";
  id: string;
  name: string;
  birthday: string;
  daysLeft: number;
  owner: string | null;
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

function objectToChartData(obj: Record<string, number>, labelMap: Record<string, string>) {
  return Object.entries(obj).map(([key, value]) => ({ key, name: labelMap[key] ?? key, value }));
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [charts, setCharts] = useState<DashboardCharts>({});
  const [liveDollar, setLiveDollar] = useState<LiveDollarOfficial | null>(null);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const [dollarBarExpanded, setDollarBarExpanded] = useState(false);

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
    api
      .get("/notifications/birthdays/upcoming?days=14")
      .then((res) => setUpcomingBirthdays(res.data.upcoming ?? []))
      .catch(() => setUpcomingBirthdays([]));
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
  const items = isAdmin
    ? [
        { key: "devices", label: "Equipos", icon: Package, to: "/inventory" },
        { key: "resellers", label: "Revendedores", icon: Users, to: "/resellers" },
        { key: "consignments", label: "Consignaciones", icon: Truck, to: "/consignments" },
        { key: "paymentsPending", label: "Pagos pendientes", icon: Banknote, to: "/payments" },
        { key: "totalDebtCents", label: "Deuda total (USD)", icon: Wallet, to: "/debts" }
      ]
    : [
        { key: "devices", label: "Equipos", icon: Package, to: "/inventory" },
        { key: "paymentsPending", label: "Pagos pendientes", icon: Banknote, to: "/payments" },
        { key: "debtCents", label: "Mi deuda (USD)", icon: Wallet, to: "/debts" }
      ];

  const devicesByStateData = useMemo(
    () =>
      charts.devicesByState
        ? objectToChartData(charts.devicesByState, STATE_LABELS).filter((d) => d.value > 0)
        : [],
    [charts.devicesByState]
  );
  const consignmentsByStatusData = useMemo(
    () =>
      charts.consignmentsByStatus
        ? objectToChartData(charts.consignmentsByStatus, { active: "Activas", sold: "Vendidas" }).filter(
            (d) => d.value > 0
          )
        : [],
    [charts.consignmentsByStatus]
  );
  const paymentsByStatusData = charts.paymentsByStatus
    ? objectToChartData(charts.paymentsByStatus, PAYMENT_LABELS).filter((d) => d.value > 0)
    : [];
  const debtByResellerData = charts.debtByReseller ?? [];
  const totalDevices = devicesByStateData.reduce((acc, d) => acc + d.value, 0);

  const formatArs = (value: number | null | undefined) =>
    typeof value === "number"
      ? value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "--";

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

      <div className="silva-home-kpi-row">
        {items.map(({ key, label, icon: Icon, to }) => (
          <button
            key={key}
            type="button"
            className="silva-home-kpi-card silva-home-kpi-card--clickable"
            onClick={() => navigate(to)}
          >
            <div className="silva-home-kpi-card__icon">
              <Icon size={16} />
            </div>
            <div className="silva-home-kpi-card__value">
              {key.includes("Cents") && typeof kpis[key] === "number"
                ? ((kpis[key] as number) / 100).toFixed(2)
                : (kpis[key] ?? 0)}
            </div>
            <div className="silva-home-kpi-card__label">{label}</div>
          </button>
        ))}
      </div>

      <div className="silva-home-quick-row">
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/inventory")}>
          <Package size={16} />
          <span>Stock</span>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/payments")}>
          <Banknote size={16} />
          <span>Pagos</span>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/debts")}>
          <Wallet size={16} />
          <span>Deuda</span>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="silva-home-quick-btn" onClick={() => navigate("/consignments")}>
          <Truck size={16} />
          <span>Consignaciones</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="silva-home-grid">
        <Box className="silva-home-section">
          <div className="silva-home-section__head">
            <h3>Estado de stock</h3>
            <span>{totalDevices} equipos</span>
          </div>
          {devicesByStateData.length ? (
            <div className="silva-home-list">
              {devicesByStateData.map((item) => {
                const pct = totalDevices ? Math.round((item.value / totalDevices) * 100) : 0;
                return (
                  <div key={item.key} className="silva-home-list__item">
                    <div className="silva-home-list__row">
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="silva-home-progress">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="silva-helper">Sin datos de stock.</p>
          )}
        </Box>

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

        {isAdmin && debtByResellerData.length > 0 && (
          <Box className="silva-home-section">
            <div className="silva-home-section__head">
              <h3>Top deuda por revendedor</h3>
              <button type="button" onClick={() => navigate("/debts")}>
                Abrir
              </button>
            </div>
            <div className="silva-home-list">
              {debtByResellerData.slice(0, 5).map((item) => (
                <div key={item.resellerName} className="silva-home-list__item silva-home-list__item-inline">
                  <span>{item.resellerName}</span>
                  <strong>{(item.balanceCents / 100).toFixed(2)} USD</strong>
                </div>
              ))}
            </div>
          </Box>
        )}

        {isAdmin && consignmentsByStatusData.length > 0 && (
          <Box className="silva-home-section">
            <div className="silva-home-section__head">
              <h3>Consignaciones</h3>
              <button type="button" onClick={() => navigate("/consignments")}>
                Abrir
              </button>
            </div>
            <div className="silva-home-chip-grid">
              {consignmentsByStatusData.map((item) => (
                <div key={item.key} className="silva-home-chip">
                  <span>{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </Box>
        )}

        {isAdmin && (
          <Box className="silva-home-section">
            <div className="silva-home-section__head">
              <h3>Cumpleaños próximos (14 días)</h3>
            </div>
            {upcomingBirthdays.length ? (
              <div className="silva-home-list">
                {upcomingBirthdays.slice(0, 6).map((b) => (
                  <div key={`${b.kind}-${b.id}`} className="silva-home-list__item silva-home-list__item-inline">
                    <div>
                      <div>{b.name}</div>
                      <small className="silva-helper">
                        {b.kind === "reseller" ? "Revendedor" : "Cliente"} · {new Date(b.birthday).toLocaleDateString()}
                      </small>
                    </div>
                    <strong>{b.daysLeft}d</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="silva-helper">No hay cumpleaños próximos.</p>
            )}
          </Box>
        )}
      </div>
    </div>
  );
}
