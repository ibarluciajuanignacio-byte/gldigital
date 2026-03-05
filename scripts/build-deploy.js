/**
 * Build para despliegue único: frontend con API en misma origen + copia a apps/api/dist/public.
 * Uso: node scripts/build-deploy.js (o npm run build:deploy desde la raíz).
 * Si falla el build de la API, la copia NO se ejecuta y el sitio sigue sirviendo la versión anterior.
 */
const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
process.chdir(root);

process.env.VITE_API_URL = "";

function step(name, fn) {
  console.log("\n--- " + name + " ---");
  try {
    fn();
    console.log("OK: " + name);
    return true;
  } catch (err) {
    console.error("FALLO en: " + name);
    console.error(err.message || err);
    process.exit(1);
  }
}

step("Building web (same-origin)", () => {
  execSync("npm run build --workspace @gldigital/web", { stdio: "inherit", env: process.env });
});

step("Building API", () => {
  execSync("npm run build --workspace @gldigital/api", { stdio: "inherit" });
});

step("Copying web dist to API public", () => {
  require("./copy-web-to-api.js");
});

const publicDir = path.join(root, "apps", "api", "dist", "public");
const indexPath = path.join(publicDir, "index.html");
if (fs.existsSync(indexPath)) {
  const stat = fs.statSync(indexPath);
  console.log("\n=== Build listo ===");
  console.log("  index.html modificado:", stat.mtime.toISOString());
  console.log("  Reiniciá el proceso de la API (ej. pm2 restart all) para servir esta versión.");
} else {
  console.warn("\nAdvertencia: no se encontró apps/api/dist/public/index.html");
}
console.log("");
