import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Box } from "../components/Box";
import { Wallet } from "lucide-react";

type CashBox = {
  id: string;
  name: string;
  currency: string;
  type: string;
  balanceCents: number;
  lastMovement: { description: string; createdAt: string } | null;
};

function formatCents(cents: number, currency: string): string {
  const sym = currency === "USD" ? "US$" : currency === "USDT" ? "USDT " : "$";
  return `${sym} ${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

export function CashboxesPage() {
  const [boxes, setBoxes] = useState<CashBox[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", currency: "USD", type: "general" });
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const { data } = await api.get<{ boxes: CashBox[] }>("/cashboxes");
      setBoxes(data.boxes ?? []);
    } catch {
      setError("No se pudo cargar las cajas.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Nombre es obligatorio.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/cashboxes", {
        name: form.name.trim(),
        currency: form.currency,
        type: form.type
      });
      setForm({ name: "", currency: "USD", type: "general" });
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo crear la caja.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="silva-alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <Box className="mb-6">
        <form onSubmit={onCreate} className="silva-form-grid">
          <div className="silva-col-12">
            <span className="silva-badge silva-badge-primary">Nueva caja</span>
          </div>
          <div className="silva-col-4">
            <label className="silva-label">Nombre *</label>
            <input
              className="silva-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej. Caja Efectivo USD"
            />
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Moneda</label>
            <select
              className="silva-input"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          <div className="silva-col-2">
            <label className="silva-label">Tipo</label>
            <select
              className="silva-input"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="general">General</option>
              <option value="petty">Caja chica</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
          <div className="silva-col-2 flex items-end pb-2">
            <button type="submit" className="silva-btn silva-btn-primary" disabled={creating}>
              {creating ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      </Box>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {boxes.map((box) => (
          <Link key={box.id} to={`/cashboxes/${box.id}`} className="block">
            <Box className="hover:border-silva-primary/50 transition-colors cursor-pointer h-full">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-silva-muted" />
                <span className="font-medium">{box.name}</span>
                <span className="silva-badge silva-badge-secondary text-xs">
                  {box.currency}
                </span>
                <span className="silva-badge silva-badge-outline text-xs">
                  {box.type === "general" ? "General" : box.type === "petty" ? "Caja chica" : "Crypto"}
                </span>
              </div>
              <p className="text-xl font-semibold text-silva-fg">
                {formatCents(box.balanceCents, box.currency)}
              </p>
              {box.lastMovement && (
                <p className="text-sm text-silva-muted mt-1 truncate" title={box.lastMovement.description}>
                  Último: {box.lastMovement.description}
                </p>
              )}
            </Box>
          </Link>
        ))}
      </div>
      {boxes.length === 0 && !error && (
        <Box className="text-center text-silva-muted py-8">
          No hay cajas. Creá una desde el formulario de arriba.
        </Box>
      )}
    </div>
  );
}
