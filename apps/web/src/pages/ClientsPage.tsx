import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";

type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  birthday?: string;
  reseller?: { user?: { name: string } };
};

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    birthday: ""
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { data } = await api.get("/clients");
      setClients(data.clients ?? []);
    } catch {
      setError("No se pudo cargar clientes.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/clients", {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        city: form.city.trim() || undefined,
        birthday: form.birthday ? new Date(form.birthday).toISOString() : undefined
      });
      setForm({ name: "", email: "", phone: "", city: "", birthday: "" });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "No se pudo crear cliente.");
    }
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Clientes</h2>
      </div>
      {error && <div className="silva-alert">{error}</div>}

      {user?.role === "admin" && (
        <Box className="mb-6">
          <form onSubmit={onCreate} className="silva-form-grid">
            <div className="silva-col-3">
              <label className="silva-label">Nombre</label>
              <input className="silva-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="silva-col-3">
              <label className="silva-label">Email</label>
              <input className="silva-input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="silva-col-2">
              <label className="silva-label">Teléfono</label>
              <input className="silva-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="silva-col-2">
              <label className="silva-label">Ciudad</label>
              <input className="silva-input" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="silva-col-2">
              <label className="silva-label">Cumpleaños</label>
              <input type="date" className="silva-input" value={form.birthday} onChange={(e) => setForm((p) => ({ ...p, birthday: e.target.value }))} />
            </div>
            <div className="silva-col-12">
              <button type="submit" className="silva-btn silva-btn-primary">Crear cliente</button>
            </div>
          </form>
        </Box>
      )}

      <Box className="p-0 overflow-hidden">
        <div className="silva-table-wrap">
          <table className="silva-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>Cumpleaños</th>
                <th>Vinculado a</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.email ?? "-"}</td>
                  <td>{client.phone ?? "-"}</td>
                  <td>{client.city ?? "-"}</td>
                  <td>{client.birthday ? new Date(client.birthday).toLocaleDateString() : "-"}</td>
                  <td>{client.reseller?.user?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}

