import axios from "axios";

/** En dev usa proxy. En producción: si VITE_API_URL es "" usamos misma origen (API sirve el front). */
export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return "/api";
  }
  const url = import.meta.env.VITE_API_URL;
  return url !== undefined ? url : "http://localhost:4000";
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Mostrar errores de API en consola (y opcionalmente alert si no hay manejo en la página)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message ?? err.message ?? "Error de conexión";
    const status = err.response?.status;
    console.error("[API]", status ? `${status}: ${msg}` : msg, err);
    return Promise.reject(err);
  }
);

export function setAuthToken(token?: string): void {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}
