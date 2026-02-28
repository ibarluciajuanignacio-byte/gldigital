import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";

export function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [form, setForm] = useState({ resellerId: "", amount: "", note: "" });

  async function load() {
    const [paymentsRes, resellersRes] = await Promise.all([
      api.get("/payments"),
      user?.role === "admin" ? api.get("/resellers") : Promise.resolve({ data: { resellers: [] } })
    ]);
    setPayments(paymentsRes.data.payments);
    setResellers(resellersRes.data.resellers);
    if (user?.role === "reseller" && user.resellerId) {
      setForm((p) => ({ ...p, resellerId: user.resellerId! }));
    }
  }

  useEffect(() => {
    load();
  }, [user?.role]);

  async function reportPayment(e: FormEvent) {
    e.preventDefault();
    await api.post("/payments/report", {
      resellerId: form.resellerId,
      amount: Number(form.amount),
      note: form.note
    });
    setForm((p) => ({ ...p, amount: "", note: "" }));
    await load();
  }

  async function review(paymentId: string, action: "confirm" | "reject") {
    await api.post(`/payments/${paymentId}/${action}`);
    await load();
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Pagos reportados</h2>
      </div>
      {(user?.role === "reseller" || user?.role === "admin") && (
        <Box className="mb-6">
          <form onSubmit={reportPayment} className="silva-form-grid">
            {user?.role === "admin" && (
              <div className="silva-col-4">
                <label className="silva-label">Revendedor</label>
                <select
                  className="silva-select"
                  value={form.resellerId}
                  onChange={(e) => setForm((p) => ({ ...p, resellerId: e.target.value }))}
                >
                  <option value="">Seleccionar</option>
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.user.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="silva-col-4">
              <label className="silva-label">Monto USD</label>
              <input
                className="silva-input"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="silva-col-4">
              <label className="silva-label">Nota</label>
              <input
                className="silva-input"
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
            <div className="silva-col-12" style={{ display: "flex", alignItems: "end" }}>
              <button type="submit" className="silva-btn silva-btn-primary">
                Emitir pago
              </button>
            </div>
          </form>
        </Box>
      )}

      <Box className="silva-card p-0 overflow-hidden">
        <div className="silva-datatable">
          <div className="silva-table-wrap">
            <table className="silva-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Revendedor</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td data-label="Fecha">{new Date(payment.createdAt).toLocaleString()}</td>
                    <td data-label="Revendedor">{payment.reseller.user.name}</td>
                    <td data-label="Monto">{(payment.amountCents / 100).toFixed(2)} USD</td>
                    <td data-label="Estado">{payment.status}</td>
                    <td data-label="Acción">
                      {user?.role === "admin" && payment.status === "reported_pending" ? (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="silva-btn silva-btn-primary"
                            onClick={() => review(payment.id, "confirm")}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="silva-btn silva-btn-danger"
                            onClick={() => review(payment.id, "reject")}
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Box>
    </div>
  );
}
