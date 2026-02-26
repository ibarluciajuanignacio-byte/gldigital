import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";

export function DebtsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<{
    items?: { resellerId: string; resellerName: string; balanceCents: number }[];
    balanceCents?: number;
    entries?: { id: string; createdAt: string; entryType: string; amountCents: number; reason: string }[];
  } | null>(null);

  useEffect(() => {
    api.get("/debts/summary").then((res) => setData(res.data));
  }, []);

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Deuda viva</h2>
      </div>
      <Box className="p-0 overflow-hidden">
        {user?.role === "admin" ? (
          <div className="silva-table-wrap">
            <table className="silva-table silva-table--compact">
              <thead>
                <tr>
                  <th>Revendedor</th>
                  <th>Saldo (USD)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((item) => (
                  <tr key={item.resellerId}>
                    <td>{item.resellerName}</td>
                    <td>{(item.balanceCents / 100).toFixed(2)}</td>
                    <td>
                      <Link to={`/resellers/${item.resellerId}`} className="silva-link">
                        Ajustar deuda
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <h3 className="silva-page-title" style={{ fontSize: "1rem", marginBottom: "10px" }}>
              Saldo actual: {((data?.balanceCents ?? 0) / 100).toFixed(2)} USD
            </h3>
            <div className="silva-table-wrap">
              <table className="silva-table silva-table--compact">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Razon</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.entries ?? []).map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.entryType}</td>
                      <td>{(entry.amountCents / 100).toFixed(2)}</td>
                      <td>{entry.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Box>
    </div>
  );
}
