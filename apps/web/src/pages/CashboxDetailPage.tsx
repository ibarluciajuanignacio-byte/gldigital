import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { ArrowLeft } from "lucide-react";

type CashMovement = {
  id: string;
  type: string;
  amountCents: number;
  currency: string;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
};

type CashBoxDetail = {
  id: string;
  name: string;
  currency: string;
  type: string;
  balanceCents: number;
  movements: CashMovement[];
};

function formatCents(cents: number, currency: string): string {
  const sym = currency === "USD" ? "US$" : currency === "USDT" ? "USDT " : "$";
  return `${sym} ${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function CashboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [box, setBox] = useState<CashBoxDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: "credit" as "credit" | "debit",
    amountCents: "",
    description: ""
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const { data } = await api.get<{ box: CashBoxDetail }>(`/cashboxes/${id}`);
      setBox(data.box);
    } catch {
      setError("No se pudo cargar la caja.");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function onAddMovement(e: FormEvent) {
    e.preventDefault();
    if (!id || !box) return;
    const amount = Math.round(parseFloat(movementForm.amountCents.replace(",", ".")) * 100);
    if (!Number.isFinite(amount) || amount <= 0 || !movementForm.description.trim()) {
      setError("Monto positivo y descripción son obligatorios.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/cashboxes/movements", {
        cashBoxId: id,
        type: movementForm.type,
        amountCents: amount,
        currency: box.currency,
        description: movementForm.description.trim()
      });
      setMovementForm((p) => ({ ...p, amountCents: "", description: "" }));
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo registrar el movimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) return null;
  if (!box && !error) return <div className="p-4">Cargando…</div>;
  if (!box) return <div className="p-4 silva-alert">{error}</div>;

  return (
    <div>
      <div className="silva-page-header flex items-center gap-4 flex-wrap">
        <Link to="/cashboxes" className="silva-btn silva-btn-ghost p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="silva-page-title">{box.name}</h2>
        <span className="silva-badge silva-badge-secondary">{box.currency}</span>
        <span className="silva-badge silva-badge-outline">
          {box.type === "general" ? "General" : box.type === "petty" ? "Caja chica" : "Crypto"}
        </span>
      </div>
      {error && (
        <div className="silva-alert mb-4">{error}</div>
      )}

      <Box className="mb-6">
        <p className="text-2xl font-semibold text-silva-fg">
          Saldo: {formatCents(box.balanceCents, box.currency)}
        </p>
      </Box>

      <Box className="mb-6">
        <span className="silva-badge silva-badge-primary mb-4 block">Nuevo movimiento</span>
        <form onSubmit={onAddMovement} className="silva-form-grid">
          <div className="silva-col-2">
            <label className="silva-label">Tipo</label>
            <select
              className="silva-input"
              value={movementForm.type}
              onChange={(e) => setMovementForm((p) => ({ ...p, type: e.target.value as "credit" | "debit" }))}
            >
              <option value="credit">Ingreso</option>
              <option value="debit">Egreso</option>
            </select>
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Monto</label>
            <input
              className="silva-input"
              type="text"
              inputMode="decimal"
              value={movementForm.amountCents}
              onChange={(e) => setMovementForm((p) => ({ ...p, amountCents: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="silva-col-4">
            <label className="silva-label">Descripción *</label>
            <input
              className="silva-input"
              value={movementForm.description}
              onChange={(e) => setMovementForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Ej. Venta contado, Pago proveedor"
            />
          </div>
          <div className="silva-col-2 flex items-end pb-2">
            <button type="submit" className="silva-btn silva-btn-primary" disabled={submitting}>
              {submitting ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </form>
      </Box>

      <Box>
        <h3 className="font-medium mb-4">Últimos movimientos</h3>
        <div className="overflow-x-auto">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {box.movements.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-silva-muted py-4">
                    Sin movimientos aún.
                  </td>
                </tr>
              )}
              {box.movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.createdAt)}</td>
                  <td>
                    <span className={m.type === "credit" ? "silva-badge silva-badge-success" : "silva-badge silva-badge-danger"}>
                      {m.type === "credit" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                  <td>{m.description}</td>
                  <td className="text-right font-mono">
                    {m.type === "credit" ? "+" : "-"}
                    {formatCents(m.amountCents, m.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}
