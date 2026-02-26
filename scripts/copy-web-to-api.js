/**
 * Copia el build del frontend (apps/web/dist) a apps/api/dist/public
 * para despliegue único: la API sirve el sitio en producción.
 * Ejecutar desde la raíz del proyecto después de "npm run build".
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const webDist = path.join(root, "apps", "web", "dist");
const apiPublic = path.join(root, "apps", "api", "dist", "public");

if (!fs.existsSync(webDist)) {
  console.error("No existe apps/web/dist. Ejecutá antes: npm run build --workspace @gldigital/web");
  process.exit(1);
}

fs.mkdirSync(apiPublic, { recursive: true });
fs.cpSync(webDist, apiPublic, { recursive: true });
console.log("Listo: frontend copiado a apps/api/dist/public");
