/**
 * Copia el frontend listo para producción (apps/api/dist/public) a deploy-public/
 * en la raíz del proyecto. Para hosting que solo sirve archivos estáticos:
 * subí el CONTENIDO de deploy-public/ a la carpeta pública del servidor.
 * Ejecutar después de: npm run build:deploy
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = path.join(root, "apps", "api", "dist", "public");
const target = path.join(root, "deploy-public");

if (!fs.existsSync(source) || !fs.existsSync(path.join(source, "index.html"))) {
  console.error(
    "No existe apps/api/dist/public con index.html. Ejecutá antes: npm run build:deploy"
  );
  process.exit(1);
}

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true });
}
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log("Listo. Subí el CONTENIDO de la carpeta deploy-public/ al public del servidor.");
