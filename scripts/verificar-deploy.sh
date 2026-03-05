#!/bin/bash
# Ejecutar en el servidor desde la raíz del proyecto: bash scripts/verificar-deploy.sh
# Ayuda a ver por qué no se ven los cambios en producción.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Carpeta del proyecto ==="
echo "$ROOT"
echo ""

echo "=== 2. ¿Existe el build del front dentro de la API? ==="
PUBLIC="$ROOT/apps/api/dist/public"
if [ -f "$PUBLIC/index.html" ]; then
  echo "Sí. index.html en apps/api/dist/public:"
  ls -la "$PUBLIC/index.html"
  if [ -f "$PUBLIC/build-info.json" ]; then
    echo "build-info.json (lo que debería servir el sitio):"
    cat "$PUBLIC/build-info.json"
  else
    echo "(No hay build-info.json; puede ser un build antiguo.)"
  fi
else
  echo "NO. No existe $PUBLIC/index.html"
  echo "Ejecutá: npm run build:deploy"
fi
echo ""

echo "=== 3. ¿NODE_ENV en producción? ==="
echo "Si la API no tiene NODE_ENV=production, NO sirve el front desde dist/public."
echo "Al arrancar la API usá: NODE_ENV=production node apps/api/dist/server.js"
echo "O en .env: NODE_ENV=production"
echo ""

echo "=== 4. ¿Cómo se inicia la API? (revisar PM2 o el comando que usen) ==="
if command -v pm2 &>/dev/null; then
  pm2 list 2>/dev/null || true
  echo ""
  echo "Variables de entorno del proceso (NODE_ENV debe ser production para servir el front):"
  pm2 env 0 2>/dev/null | grep -E "NODE_ENV|PWD" || true
  echo ""
  echo "Para reiniciar después del build: pm2 restart all"
else
  echo "PM2 no está instalado. Reiniciá a mano el proceso que corre node apps/api/dist/server.js"
fi
echo ""

echo "=== 5. ¿Nginx sirve este dominio desde otra carpeta? ==="
echo "Si usás nginx, revisá la config del sitio (ej. /etc/nginx/sites-enabled/):"
echo "  grep -r 'gldigital\|root\|server_name' /etc/nginx/ 2>/dev/null || true"
echo "Si 'root' apunta a otra ruta (ej. public_html), los cambios están en apps/api/dist/public pero nginx sirve otra carpeta."
echo ""

echo "=== 6. Resumen ==="
echo "Para que se vean los cambios:"
echo "  1. npm run build:deploy   (desde la raíz del repo)"
echo "  2. NODE_ENV=production al arrancar la API"
echo "  3. Reiniciar el proceso de la API (pm2 restart all o similar)"
echo "  4. Si nginx sirve archivos estáticos, que apunte a apps/api/dist/public o copiar su contenido a la ruta que use nginx."
