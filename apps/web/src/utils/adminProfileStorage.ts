/**
 * Almacenamiento local del nombre e imagen del administrador (Configuración).
 * Usado por SettingsPage para guardar y por MainLayout para mostrar en la sidebar.
 */

export const ADMIN_NAME_KEY = "gldigital_admin_name";
export const ADMIN_AVATAR_KEY = "gldigital_admin_avatar";

export function getStoredAdminName(): string {
  try {
    return localStorage.getItem(ADMIN_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getStoredAdminAvatar(): string {
  try {
    return localStorage.getItem(ADMIN_AVATAR_KEY) ?? "";
  } catch {
    return "";
  }
}
