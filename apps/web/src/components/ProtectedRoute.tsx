import { Outlet } from "react-router-dom";
import { useAuth } from "../state/auth";

export function ProtectedRoute() {
  const { hydrated } = useAuth();
  if (!hydrated) return null;
  return <Outlet />;
}
