import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { LogOut, Menu, X, Plus, Barcode, Settings, ChevronLeft, ChevronRight, Calculator } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { ImeiBarcodeScannerModal } from "../components/ImeiBarcodeScannerModal";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { LordIcon, type LordIconName } from "../components/LordIcon";
import { RouteTransitionPreloader } from "../components/RouteTransitionPreloader";
import { CalculatorModal } from "../components/CalculatorModal";
import { ThemeProvider } from "../context/ThemeContext";
import { useDarkMode } from "../hooks/useDarkMode";
import { isMobile } from "../utils/isMobile";
import { getStoredAdminName, getStoredAdminAvatar } from "../utils/adminProfileStorage";

type NavLinkItem = {
  to: string;
  label: string;
  lordIcon?: LordIconName;
  icon?: React.ComponentType<{ size?: number }>;
};

const links: NavLinkItem[] = [
  { to: "/", label: "Dashboard", lordIcon: "dashboard" },
  { to: "/inventory", label: "Stock", lordIcon: "stock" },
  { to: "/suppliers", label: "Proveedores", lordIcon: "proveedores" },
  { to: "/purchases", label: "Compras", lordIcon: "orden_compra" },
  { to: "/resellers", label: "Revendedores", lordIcon: "resellers" },
  { to: "/resellers/map", label: "Mapa revendedores", lordIcon: "map" },
  { to: "/clients", label: "Clientes", lordIcon: "clientes" },
  { to: "/consignments", label: "Consignaciones", lordIcon: "coonsignacion" },
  { to: "/debts", label: "Deuda viva", lordIcon: "deuda" },
  { to: "/payments", label: "Pagos", lordIcon: "caja" },
  { to: "/cashboxes", label: "Cajas", lordIcon: "caja" },
  { to: "/chat", label: "Chat", lordIcon: "chat" },
  { to: "/technicians", label: "Técnicos", lordIcon: "tecnicios" },
  { to: "/settings", label: "Configuración", icon: Settings },
];

function NavIcon({ item, size = 16 }: { item: NavLinkItem; size?: number }) {
  if (item.lordIcon) return <LordIcon name={item.lordIcon} size={size} />;
  if (item.icon) return <item.icon size={size} />;
  return null;
}

export function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDarkMode, setDarkMode] = useDarkMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreTouchStartY = useRef<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("gldigital-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [quickModal, setQuickModal] = useState<"payment" | "debt" | "request" | "stock" | "calculator" | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  const [resellers, setResellers] = useState<Array<{ id: string; user: { name: string } }>>([]);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ resellerId: "", amount: "", note: "" });

  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<
    Array<{ id: string; name: string; offers: Array<{ id: string; name: string; variants: Array<{ id: string; label: string }> }> }>
  >([]);
  const [requestForm, setRequestForm] = useState({
    resellerId: "",
    variantId: "",
    title: "",
    quantity: "1",
    note: ""
  });

  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [stockForm, setStockForm] = useState({
    serialNumber: "",
    imei: "",
    model: ""
  });
  const [quickImeiScannerOpen, setQuickImeiScannerOpen] = useState(false);
  const [, setProfileVersion] = useState(0);

  const [debtSummary, setDebtSummary] = useState<{
    items?: Array<{ resellerId: string; resellerName: string; balanceCents: number }>;
    balanceCents?: number;
  } | null>(null);
  const [selectedDebtResellerId, setSelectedDebtResellerId] = useState("");

  const pageTitles: Record<string, string> = {
    "/": "Dashboard",
    "/inventory": "Stock",
    "/suppliers": "Proveedores",
    "/purchases": "Compras",
    "/resellers": "Revendedores",
    "/resellers/map": "Mapa revendedores",
    "/clients": "Clientes",
    "/consignments": "Consignaciones",
    "/debts": "Deuda viva",
    "/payments": "Pagos",
    "/cashboxes": "Cajas",
    "/chat": "Chat",
    "/technicians": "Técnicos",
    "/settings": "Configuración",
  };
  const currentTitle =
    pageTitles[location.pathname] ??
    (location.pathname.startsWith("/cashboxes/") ? "Caja" : location.pathname.startsWith("/suppliers/") ? "Ficha de proveedor" : "GLdigital");

  /* Todas las rutas accesibles (candado de módulos desactivado) */
  const isLockedPath = false;

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileMoreOpen(false);
    setIsQuickMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem("gldigital-sidebar-collapsed", sidebarCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handler = () => setProfileVersion((v) => v + 1);
    window.addEventListener("gldigital-admin-profile-updated", handler);
    return () => window.removeEventListener("gldigital-admin-profile-updated", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    setIsMobileView(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function isActivePath(pathname: string) {
    if (pathname === "/") return location.pathname === "/";
    return location.pathname.startsWith(pathname);
  }

  async function loadResellersIfNeeded(): Promise<Array<{ id: string; user: { name: string } }>> {
    if (user?.role !== "admin") return [];
    if (resellers.length) return resellers;
    const { data } = await api.get("/resellers");
    setResellers(data.resellers ?? []);
    return data.resellers ?? [];
  }

  async function openQuickModal(type: "payment" | "debt" | "request" | "stock" | "calculator") {
    setQuickError(null);
    setIsQuickMenuOpen(false);
    setQuickModal(type);
    try {
      if (type === "payment") {
        const adminResellers = await loadResellersIfNeeded();
        if (user?.role === "admin") {
          setPaymentForm((p) => ({
            ...p,
            resellerId: p.resellerId || adminResellers[0]?.id || ""
          }));
        } else if (user?.role === "reseller" && user.resellerId) {
          setPaymentForm((p) => ({ ...p, resellerId: user.resellerId! }));
        }
      }

      if (type === "request") {
        const [catRes, adminResellers] = await Promise.all([
          api.get("/stock/catalog"),
          loadResellersIfNeeded()
        ]);
        setCatalog(catRes.data.categories ?? []);
        if (user?.role === "admin") {
          setRequestForm((p) => ({
            ...p,
            resellerId: p.resellerId || adminResellers[0]?.id || ""
          }));
        } else if (user?.role === "reseller" && user.resellerId) {
          setRequestForm((p) => ({ ...p, resellerId: user.resellerId! }));
        }
      }

      if (type === "debt") {
        const { data } = await api.get("/debts/summary");
        setDebtSummary(data);
        if (user?.role === "admin") {
          const firstId = data?.items?.[0]?.resellerId ?? "";
          setSelectedDebtResellerId(firstId);
        } else {
          setSelectedDebtResellerId(user?.resellerId ?? "");
        }
      }
    } catch (err: any) {
      setQuickError(err?.response?.data?.message ?? "No se pudo abrir la acción rápida.");
    }
  }

  function closeQuickModal() {
    setQuickModal(null);
    setQuickError(null);
    setQuickImeiScannerOpen(false);
  }

  async function submitQuickPayment(e: FormEvent) {
    e.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!paymentForm.resellerId) {
      setQuickError("Seleccioná revendedor.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setQuickError("Ingresá un monto válido.");
      return;
    }
    setPaymentSubmitting(true);
    setQuickError(null);
    try {
      await api.post("/payments/report", {
        resellerId: paymentForm.resellerId,
        amount,
        note: paymentForm.note || undefined
      });
      setPaymentForm((p) => ({ ...p, amount: "", note: "" }));
      closeQuickModal();
      navigate("/payments");
    } catch (err: any) {
      setQuickError(err?.response?.data?.error ?? err?.response?.data?.message ?? "No se pudo reportar el pago.");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function submitQuickRequest(e: FormEvent) {
    e.preventDefault();
    const quantity = Number(requestForm.quantity);
    if (!requestForm.title.trim()) {
      setQuickError("El título es obligatorio.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuickError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (user?.role === "admin" && !requestForm.resellerId) {
      setQuickError("Seleccioná revendedor.");
      return;
    }
    setRequestSubmitting(true);
    setQuickError(null);
    try {
      await api.post("/stock/requests", {
        resellerId: requestForm.resellerId || undefined,
        variantId: requestForm.variantId || undefined,
        title: requestForm.title.trim(),
        quantity,
        note: requestForm.note.trim() || undefined
      });
      setRequestForm((p) => ({ ...p, variantId: "", title: "", quantity: "1", note: "" }));
      closeQuickModal();
      navigate("/inventory");
    } catch (err: any) {
      setQuickError(err?.response?.data?.message ?? "No se pudo crear la solicitud.");
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function submitQuickStock(e: FormEvent) {
    e.preventDefault();
    const serialNumber = stockForm.serialNumber.trim();
    const imei = stockForm.imei.trim();
    const model = stockForm.model.trim();
    if (!serialNumber || !imei || !model) {
      setQuickError("Serie, IMEI y modelo son obligatorios.");
      return;
    }
    setStockSubmitting(true);
    setQuickError(null);
    try {
      await api.post("/devices", {
        serialNumber,
        imei,
        model,
        state: "available"
      });
      setStockForm({ serialNumber: "", imei: "", model: "" });
      closeQuickModal();
      navigate("/inventory");
    } catch (err: any) {
      setQuickError(err?.response?.data?.message ?? "No se pudo agregar el equipo.");
    } finally {
      setStockSubmitting(false);
    }
  }

  const mobilePrimaryLinks: NavLinkItem[] = [
    { to: "/", label: "Inicio", lordIcon: "dashboard" },
    { to: "/inventory", label: "Stock", lordIcon: "stock" },
    { to: "/payments", label: "Pagos", lordIcon: "caja" },
    { to: "/chat", label: "Chat", lordIcon: "chat" }
  ];

  /* Acciones rápidas FAB: Calculadora, Compra, Movimientos, Cajas; apiladas arriba del FAB para no solaparse (ancho botón 118px → centrado con x -59) */
  const mobileQuickActions: Array<{
    key: string;
    label: string;
    lordIcon?: LordIconName;
    icon?: React.ComponentType<{ size?: number }>;
    x: number;
    y: number;
    action: "navigate" | "modal";
    to?: string;
    modal?: "debt" | "calculator";
  }> = [
    { key: "calculator", label: "Calculadora", icon: Calculator, x: -59, y: -225, action: "modal", modal: "calculator" },
    { key: "purchase", label: "Compra", lordIcon: "orden_compra", x: -59, y: -165, action: "navigate", to: "/purchases" },
    { key: "movements", label: "Movimientos", lordIcon: "deuda", x: -59, y: -105, action: "modal", modal: "debt" },
    { key: "cashboxes", label: "Cajas", lordIcon: "caja", x: -59, y: -45, action: "navigate", to: "/cashboxes" }
  ];

  if (isMobileView) {
    const currentDebtItem =
      user?.role === "admin"
        ? debtSummary?.items?.find((item) => item.resellerId === selectedDebtResellerId)
        : null;

    return (
      <ThemeProvider isDark={isDarkMode}>
      <div className="silva-mobile-shell silva-layout-fade-in">
        <header className="silva-mobile-topbar">
          <div>
            <h1 className="silva-mobile-title">{currentTitle}</h1>
            <p className="silva-mobile-subtitle">
              Hola, {user?.name ?? "Usuario"} · {user?.role ?? ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <DarkModeToggle checked={isDarkMode} onChange={setDarkMode} />
            <button
              type="button"
              className="silva-mobile-menu-btn"
              onClick={() => setMobileMoreOpen((prev) => !prev)}
              aria-label="Abrir accesos"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        <div
          className={`silva-mobile-more-wrapper ${mobileMoreOpen ? "is-open" : ""}`}
          aria-hidden={!mobileMoreOpen}
          onClick={() => setMobileMoreOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de accesos"
        >
          <div
            className="silva-mobile-more"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { mobileMoreTouchStartY.current = e.targetTouches[0].clientY; }}
            onTouchEnd={(e) => {
              const start = mobileMoreTouchStartY.current;
              if (start != null && e.changedTouches[0] && e.changedTouches[0].clientY - start > 60) setMobileMoreOpen(false);
            }}
          >
            {links
              .filter((l) => !mobilePrimaryLinks.some((p) => p.to === l.to))
              .map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={`silva-mobile-more__item ${isActivePath(link.to) ? "is-active" : ""}`}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <NavIcon item={link} size={22} />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            <button
              type="button"
              className="silva-mobile-more__item"
              onClick={logout}
            >
              <LogOut size={22} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>

        <main className="silva-mobile-content">
          <div style={{ position: "relative", height: "100%", minHeight: "100%" }}>
            <Outlet />
            {isLockedPath && (
              <div
                className="silva-module1-lock-overlay"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 35,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  padding: 24
                }}
                aria-hidden="true"
              >
                <img
                  src="/candadobigligas.png"
                  alt="Sección no disponible en esta entrega"
                  style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        </main>

        {isQuickMenuOpen && <button className="silva-mobile-fab-overlay" onClick={() => setIsQuickMenuOpen(false)} aria-label="Cerrar menú rápido" />}

        <div className={`silva-mobile-quick-actions ${isQuickMenuOpen ? "is-open" : ""}`}>
          {mobileQuickActions.map((actionConfig, index) => {
            const { key, label, lordIcon, icon: Icon, x, y, action } = actionConfig;
            return (
              <button
                key={key}
                type="button"
                className="silva-mobile-quick-action"
                style={{
                  ["--tx" as any]: `${x}px`,
                  ["--ty" as any]: `${y}px`,
                  transitionDelay: isQuickMenuOpen ? `${index * 28}ms` : "0ms"
                }}
                onClick={() => {
                  if (action === "navigate" && actionConfig.to) {
                    navigate(actionConfig.to);
                    setIsQuickMenuOpen(false);
                  } else if (action === "modal" && actionConfig.modal) {
                    openQuickModal(actionConfig.modal);
                  }
                }}
              >
                {Icon ? <Icon size={26} /> : lordIcon ? <LordIcon name={lordIcon} size={26} /> : null}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="silva-mobile-bottombar-wrap" aria-label="Navegación principal móvil">
          <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
            <defs>
              <clipPath id="silva-bottom-bar-wave" clipPathUnits="objectBoundingBox">
                {/* Ola: puntas más altas (extremos más arriba), valle en el centro */}
                <path d="M 0 0.02 Q 0.5 0.42 1 0.02 L 1 1 L 0 1 Z" />
              </clipPath>
            </defs>
          </svg>
          <div className="silva-mobile-bottombar-bar">
            <nav className="silva-mobile-bottombar">
              {mobilePrimaryLinks.slice(0, 2).map((link) => (
                <NavLink key={link.to} to={link.to} className={`silva-mobile-tab ${isActivePath(link.to) ? "is-active" : ""}`}>
                  <span className="silva-mobile-tab__icon">
                    <NavIcon item={link} size={28} />
                  </span>
                  <span>{link.label}</span>
                </NavLink>
              ))}
              <div className="silva-mobile-bottombar-fab-slot" aria-hidden="true" />
              {mobilePrimaryLinks.slice(2).map((link) => (
                <NavLink key={link.to} to={link.to} className={`silva-mobile-tab ${isActivePath(link.to) ? "is-active" : ""}`}>
                  <span className="silva-mobile-tab__icon">
                    <NavIcon item={link} size={28} />
                  </span>
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            type="button"
            className={`silva-mobile-fab ${isQuickMenuOpen ? "is-open" : ""}`}
            onClick={() => setIsQuickMenuOpen((prev) => !prev)}
            aria-label="Acciones rápidas"
          >
            <Plus size={22} />
          </button>
        </div>

        {quickModal && (
          <div
            className={`silva-modal-backdrop ${quickModal === "calculator" ? "silva-calculator-backdrop" : "silva-mobile-sheet-backdrop"}`}
            role="dialog"
            aria-modal="true"
            aria-label={quickModal === "calculator" ? "Calculadora" : "Acción rápida"}
            onClick={() => quickModal === "calculator" && setQuickModal(null)}
          >
            {quickModal === "calculator" ? (
              <CalculatorModal onClose={() => setQuickModal(null)} />
            ) : (
            <div className="silva-modal silva-mobile-sheet" onClick={(e) => e.stopPropagation()}>
              {quickModal === "payment" && (
                <>
                  <h3 className="silva-modal-title">Pago rápido</h3>
                  <p className="silva-modal-subtitle">Reporta pago sin salir de la pantalla actual.</p>
                  <form onSubmit={submitQuickPayment}>
                    {user?.role === "admin" && (
                      <>
                        <label className="silva-label">Revendedor</label>
                        <select
                          className="silva-select"
                          value={paymentForm.resellerId}
                          onChange={(e) => setPaymentForm((p) => ({ ...p, resellerId: e.target.value }))}
                        >
                          <option value="">Seleccionar</option>
                          {resellers.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.user.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <label className="silva-label" style={{ marginTop: 8 }}>Monto (USD)</label>
                    <input
                      className="silva-input"
                      type="number"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                    <label className="silva-label" style={{ marginTop: 8 }}>Nota</label>
                    <input
                      className="silva-input"
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
                    />
                    {quickError && <div className="silva-alert" style={{ marginTop: 8 }}>{quickError}</div>}
                    <div className="silva-modal-actions" style={{ marginTop: 14 }}>
                      <button type="button" className="silva-btn" onClick={closeQuickModal} disabled={paymentSubmitting}>Cancelar</button>
                      <button type="submit" className="silva-btn silva-btn-primary" disabled={paymentSubmitting}>
                        {paymentSubmitting ? "Enviando..." : "Emitir pago"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {quickModal === "request" && (
                <>
                  <h3 className="silva-modal-title">Solicitud rápida</h3>
                  <p className="silva-modal-subtitle">Crea una solicitud sin stock para aprobación.</p>
                  <form onSubmit={submitQuickRequest}>
                    {user?.role === "admin" && (
                      <>
                        <label className="silva-label">Revendedor</label>
                        <select
                          className="silva-select"
                          value={requestForm.resellerId}
                          onChange={(e) => setRequestForm((p) => ({ ...p, resellerId: e.target.value }))}
                        >
                          <option value="">Seleccionar</option>
                          {resellers.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.user.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <label className="silva-label" style={{ marginTop: 8 }}>Variante (opcional)</label>
                    <select
                      className="silva-select"
                      value={requestForm.variantId}
                      onChange={(e) => setRequestForm((p) => ({ ...p, variantId: e.target.value }))}
                    >
                      <option value="">Seleccionar</option>
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
                    {quickError && <div className="silva-alert" style={{ marginTop: 8 }}>{quickError}</div>}
                    <div className="silva-modal-actions" style={{ marginTop: 14 }}>
                      <button type="button" className="silva-btn" onClick={closeQuickModal} disabled={requestSubmitting}>Cancelar</button>
                      <button type="submit" className="silva-btn silva-btn-primary" disabled={requestSubmitting}>
                        {requestSubmitting ? "Enviando..." : "Enviar solicitud"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {quickModal === "stock" && (
                <>
                  <h3 className="silva-modal-title">Stock rápido</h3>
                  <p className="silva-modal-subtitle">Alta mínima de equipo (serie + IMEI + modelo).</p>
                  <form onSubmit={submitQuickStock}>
                    <label className="silva-label">N° de serie</label>
                    <input
                      className="silva-input"
                      value={stockForm.serialNumber}
                      onChange={(e) => setStockForm((p) => ({ ...p, serialNumber: e.target.value }))}
                    />
                    <label className="silva-label" style={{ marginTop: 8 }}>IMEI</label>
                    <div
                      className="silva-input-with-icon"
                      role={isMobile() ? "button" : undefined}
                      tabIndex={isMobile() ? 0 : undefined}
                      onClick={() => isMobile() && setQuickImeiScannerOpen(true)}
                      onKeyDown={(e) => isMobile() && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setQuickImeiScannerOpen(true))}
                      style={isMobile() ? { cursor: "pointer" } : undefined}
                    >
                      <input
                        className="silva-input"
                        value={stockForm.imei}
                        onChange={(e) => setStockForm((p) => ({ ...p, imei: e.target.value }))}
                        placeholder={isMobile() ? "Tocá para escanear código de barras" : ""}
                        readOnly={isMobile()}
                        aria-label="IMEI (en móvil tocá para escanear)"
                      />
                      <span className="silva-input-with-icon__suffix" aria-hidden>
                        <Barcode size={18} />
                      </span>
                    </div>
                    <label className="silva-label" style={{ marginTop: 8 }}>Modelo</label>
                    <input
                      className="silva-input"
                      value={stockForm.model}
                      onChange={(e) => setStockForm((p) => ({ ...p, model: e.target.value }))}
                    />
                    {quickError && <div className="silva-alert" style={{ marginTop: 8 }}>{quickError}</div>}
                    <div className="silva-modal-actions" style={{ marginTop: 14 }}>
                      <button type="button" className="silva-btn" onClick={closeQuickModal} disabled={stockSubmitting}>Cancelar</button>
                      <button type="submit" className="silva-btn silva-btn-primary" disabled={stockSubmitting}>
                        <Barcode size={16} />
                        {stockSubmitting ? "Guardando..." : "Agregar stock"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="silva-btn"
                      style={{ marginTop: 10, width: "100%" }}
                      onClick={() => {
                        closeQuickModal();
                        navigate("/inventory");
                      }}
                    >
                      Abrir formulario completo
                    </button>
                  </form>
                </>
              )}

              {quickModal === "debt" && (
                <>
                  <h3 className="silva-modal-title">Movimientos</h3>
                  <p className="silva-modal-subtitle">Registrá un pago o un movimiento de deuda/gasto del revendedor.</p>
                  {user?.role === "admin" ? (
                    <>
                      <label className="silva-label">Revendedor</label>
                      <select
                        className="silva-select"
                        value={selectedDebtResellerId}
                        onChange={(e) => setSelectedDebtResellerId(e.target.value)}
                      >
                        {(debtSummary?.items ?? []).map((item) => (
                          <option key={item.resellerId} value={item.resellerId}>
                            {item.resellerName}
                          </option>
                        ))}
                      </select>
                      <div className="silva-card" style={{ marginTop: 10, background: "#f8fafb" }}>
                        Saldo actual:{" "}
                        <strong>{(((currentDebtItem?.balanceCents ?? 0) / 100) || 0).toFixed(2)} USD</strong>
                      </div>
                    </>
                  ) : (
                    <div className="silva-card" style={{ marginTop: 10, background: "#f8fafb" }}>
                      Saldo actual: <strong>{(((debtSummary?.balanceCents ?? 0) / 100) || 0).toFixed(2)} USD</strong>
                    </div>
                  )}
                  {quickError && <div className="silva-alert" style={{ marginTop: 8 }}>{quickError}</div>}
                  <div className="silva-modal-actions" style={{ marginTop: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="silva-btn"
                      onClick={() => {
                        closeQuickModal();
                        navigate("/debts");
                      }}
                    >
                      Ir a Deuda viva
                    </button>
                    <button
                      type="button"
                      className="silva-btn silva-btn-primary"
                      onClick={() => {
                        if (user?.role === "admin" && selectedDebtResellerId) {
                          setPaymentForm((p) => ({ ...p, resellerId: selectedDebtResellerId }));
                        }
                        setQuickModal("payment");
                      }}
                    >
                      Emitir pago
                    </button>
                  </div>
                  <button type="button" className="silva-btn" style={{ marginTop: 10, width: "100%" }} onClick={closeQuickModal}>
                    Cerrar
                  </button>
                </>
              )}
            </div>
            )}
          </div>
        )}
      </div>
      <RouteTransitionPreloader />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider isDark={isDarkMode}>
    <div className={`silva-shell silva-layout-fade-in ${sidebarCollapsed ? "silva-sidebar-collapsed" : ""}`}>
      <div
        className={`silva-sidebar ${mobileMenuOpen ? "is-open" : ""}`}
        aria-label="Barra lateral principal"
      >
        <div className="silva-sidebar__brand">
          <img src="/EngineeredBigLigas.png" alt="GLdigital" className="silva-sidebar__brand-logo" />
          <button
            type="button"
            className="silva-mobile-toggle"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <div className="silva-sidebar__user">
          <img
            className="silva-avatar"
            src={
              (user?.role === "admin" && getStoredAdminAvatar()) ||
              (user?.role === "admin" ? "/admin-profile.png" : "/dist/images/fakers/profile-13.jpg")
            }
            alt=""
          />
          <div>
            <div className="silva-sidebar__name">
              {((user?.role === "admin" && getStoredAdminName()) || user?.name) ?? "Usuario"}
            </div>
            <div className="silva-sidebar__role">{user?.role ?? ""}</div>
          </div>
        </div>

        <nav className="silva-nav">
          <div className="silva-nav__title">Menu</div>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={`silva-nav__link ${isActivePath(link.to) ? "is-active" : ""}`}
              title={sidebarCollapsed ? link.label : undefined}
            >
              <NavIcon item={link} size={sidebarCollapsed ? 28 : 16} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="silva-sidebar__footer">
          <button type="button" onClick={logout} className="silva-nav__link" style={{ width: "100%" }} title={sidebarCollapsed ? "Cerrar sesión" : undefined}>
            <LogOut size={sidebarCollapsed ? 28 : 16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      <div
        className={`silva-overlay ${mobileMenuOpen ? "is-open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div className="silva-main">
        <header className="silva-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="silva-mobile-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              className="silva-sidebar-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Retraer menú"}
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            <h1 className="silva-topbar__title">{currentTitle}</h1>
          </div>
          <div className="silva-topbar__meta" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <DarkModeToggle checked={isDarkMode} onChange={setDarkMode} />
            <span>{user?.name ?? "Usuario"} - {user?.role ?? ""}</span>
          </div>
        </header>
        <main className="silva-content">
          <div style={{ position: "relative", height: "100%", minHeight: "100%" }}>
            <Outlet />
            {isLockedPath && (
              <div
                className="silva-module1-lock-overlay"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 35,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  padding: 24
                }}
                aria-hidden="true"
              >
                <img
                  src="/candadobigligas.png"
                  alt="Sección no disponible en esta entrega"
                  style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        </main>
        <footer className="silva-footer">
          <span>Powered by studio BigLigas Argentina</span>
        </footer>
      </div>

      {quickImeiScannerOpen && (
        <ImeiBarcodeScannerModal
          open={quickImeiScannerOpen}
          onClose={() => setQuickImeiScannerOpen(false)}
          onScan={(digits) => {
            setStockForm((p) => ({ ...p, imei: digits }));
            setQuickImeiScannerOpen(false);
          }}
        />
      )}
      <RouteTransitionPreloader />
    </div>
    </ThemeProvider>
  );
}
