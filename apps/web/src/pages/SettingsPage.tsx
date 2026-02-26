import type { FormEvent, ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "../state/auth";
import { Box } from "../components/Box";
import { getStoredAdminName, getStoredAdminAvatar, ADMIN_NAME_KEY, ADMIN_AVATAR_KEY } from "../utils/adminProfileStorage";

export function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName((getStoredAdminName() || user?.name) ?? "");
    setAvatarDataUrl(getStoredAdminAvatar());
  }, [user?.name]);

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
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="silva-input"
                style={{ maxWidth: 260 }}
              />
              {avatarDataUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <img
                    src={avatarDataUrl}
                    alt="Vista previa"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid var(--silva-border)"
                    }}
                  />
                  <button type="button" className="silva-btn" onClick={clearAvatar}>
                    Quitar imagen
                  </button>
                </div>
              )}
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
    </div>
  );
}
