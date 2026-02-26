/**
 * Build para despliegue único: frontend con API en misma origen + copia a apps/api/dist/public.
 * Uso: node scripts/build-deploy.js (o npm run build:deploy desde la raíz).
 */
const { execSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
process.chdir(root);

process.env.VITE_API_URL = "";

console.log("Building web (same-origin)...");
execSync("npm run build --workspace @gldigital/web", { stdio: "inherit", env: process.env });

console.log("Building API...");
execSync("npm run build --workspace @gldigital/api", { stdio: "inherit" });

console.log("Copying web dist to API public...");
require("./copy-web-to-api.js");

console.log("Listo. Desplegá la carpeta apps/api (con su dist/) o subí todo el proyecto.");
