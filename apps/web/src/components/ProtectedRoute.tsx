import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth";

export function ProtectedRoute() {
  const { token, hydrated } = useAuth();
  const location = useLocation();

  if (!hydrated) return null;
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
