import type { FormEvent } from "react";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import "./LoginPage.css";

type LoginPhase = "intro" | "form" | "exit" | "done";

const INTRO_DURATION_MS = 2000;
const EXIT_DURATION_MS = 1600;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
  const [email, setEmail] = useState("admin@gldigital.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoginPhase>("intro");
  const exitDoneRef = useRef(false);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("form"), INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/auth/bootstrap");
      await login(email, password);
      setPhase("exit");
    } catch (err) {
      setError("No fue posible iniciar sesión");
      console.error(err);
    }
  }

  useEffect(() => {
    if (phase !== "exit" || exitDoneRef.current) return;
    exitDoneRef.current = true;
    const t = setTimeout(() => {
      setPhase("done");
      navigate(from, { replace: true });
    }, EXIT_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  const showForm = phase === "form" || phase === "exit";
  const showIphone = phase !== "done";

  return (
    <div className={`silva-login silva-login--animated ${phase === "exit" ? "silva-login--fade-out" : ""}`}>
      {showForm && (
        <div
          className="silva-login-backdrop"
          aria-hidden="true"
        />
      )}
      {showIphone && (
        <div
          className={`silva-login-iphone-wrapper silva-login-iphone-wrapper--${phase}`}
          aria-hidden="true"
        >
          <img
            src="/ip17_logingldigital.png"
            alt=""
            className="silva-login-iphone"
          />
        </div>
      )}

      {showForm && (
        <>
          <div
            className={`silva-login-welcome silva-login-welcome--${phase}`}
            aria-hidden="true"
          >
            <span className="silva-login-welcome__title">Bienvenido</span>
          </div>
          <div
            className={`silva-login-card silva-login-card--over-iphone silva-login-card--${phase}`}
          >
            <h1 className="silva-login-title">Iniciar sesión</h1>
            <p className="silva-login-subtitle">Accedé al panel exclusivo de gestión para telefonía.</p>
            <form method="post" onSubmit={handleSubmit}>
              <input
                type="email"
                name="u"
                placeholder="Usuario / Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="silva-input"
              />
              <input
                type="password"
                name="p"
                placeholder="Contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="silva-input"
              />
              {error && (
                <div className="silva-alert" role="alert">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="silva-btn silva-btn-primary"
                style={{ width: "100%" }}
              >
                Entrar
              </button>
            </form>
          </div>
        </>
      )}

      {showForm && (
        <div className="silva-login-brand" aria-hidden="true">
          <img
            src="/EngineeredBigLigas.png"
            alt="Engineered by Studio Grandes Ligas"
            className="silva-login-brand__img"
          />
        </div>
      )}
    </div>
  );
}
