import type { FormEvent, ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { Upload, User } from "lucide-react";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";
import { getStoredAdminName, getStoredAdminAvatar, ADMIN_NAME_KEY, ADMIN_AVATAR_KEY } from "../utils/adminProfileStorage";

type BuildInfo = { builtAt: string; buildId: number } | null;

export function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [buildInfo, setBuildInfo] = useState<BuildInfo>(null);

  useEffect(() => {
    setName((getStoredAdminName() || user?.name) ?? "");
    setAvatarDataUrl(getStoredAdminAvatar());
  }, [user?.name]);

  useEffect(() => {
    fetch("/build-info.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BuildInfo) => data && setBuildInfo(data))
      .catch(() => {});
  }, []);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarDataUrl(dataUrl);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(ADMIN_NAME_KEY, name.trim());
      if (avatarDataUrl) {
        localStorage.setItem(ADMIN_AVATAR_KEY, avatarDataUrl);
      } else {
        localStorage.removeItem(ADMIN_AVATAR_KEY);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      window.dispatchEvent(new CustomEvent("gldigital-admin-profile-updated"));
    } catch {
      // ignore
    }
  }

  function clearAvatar() {
    setAvatarDataUrl("");
    localStorage.removeItem(ADMIN_AVATAR_KEY);
    setSaved(false);
  }

  return (
    <div>
      <div className="silva-page-header">
        <h2 className="silva-page-title">Configuración</h2>
      </div>

      <Box className="mb-6">
        <p className="silva-helper" style={{ marginBottom: "1rem" }}>
          Nombre e imagen del administrador. El resto de opciones se irá desarrollando más adelante.
        </p>
        <form onSubmit={handleSubmit} className="silva-form-grid">
          <div className="silva-col-6">
            <label className="silva-label">Nombre del administrador</label>
            <input
              type="text"
              className="silva-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder="Ej. Germán López"
            />
          </div>
          <div className="silva-col-6">
            <label className="silva-label">Imagen del administrador</label>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  border: "2px solid var(--silva-border)",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--silva-bg)"
                }}
                aria-hidden
              >
                {avatarDataUrl ? (
                  <img
                    src={avatarDataUrl}
                    alt="Imagen actual del administrador"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  <User
                    size={36}
                    style={{ color: "var(--silva-muted)" }}
                    aria-hidden
                  />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  id="settings-avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="silva-file-input-hidden"
                  aria-label="Elegir imagen del administrador"
                />
                <label
                  htmlFor="settings-avatar-file"
                  className="silva-btn silva-btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 0 }}
                >
                  <Upload size={18} aria-hidden />
                  Elegir imagen
                </label>
                {avatarDataUrl && (
                  <button type="button" className="silva-btn" onClick={clearAvatar}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="silva-col-12">
            <button type="submit" className="silva-btn silva-btn-primary">
              Guardar
            </button>
            {saved && (
              <span className="silva-helper" style={{ marginLeft: "12px", color: "var(--silva-success)" }}>
                Guardado.
              </span>
            )}
          </div>
        </form>
      </Box>
      {buildInfo && (
        <p className="silva-helper" style={{ marginTop: 24, fontSize: "0.85rem", color: "var(--silva-muted)" }}>
          Build desplegado: {new Date(buildInfo.builtAt).toLocaleString("es-AR")} (id: {buildInfo.buildId})
        </p>
      )}
    </div>
  );
}
