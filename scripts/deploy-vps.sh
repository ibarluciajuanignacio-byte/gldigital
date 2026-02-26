#!/bin/bash
# Deploy GLdigital en VPS (ejecutar en el servidor como root).
# Uso: bash scripts/deploy-vps.sh
# Requiere: Node 20, MySQL, Nginx, PM2 ya instalados.

set -e
REPO_URL="https://github.com/ibarluciajuanignacio-byte/gldigital.git"
WEB_ROOT="/var/www/gldigital"
API_PUBLIC_URL="${API_PUBLIC_URL:-http://187.77.61.37}"

echo "=== Deploy GLdigital ==="

# 1) Pedir datos si no están en entorno
# Si usás una BD ya creada (ej. Hostinger phpMyAdmin), definí USE_EXISTING_DB=1 y los GLDI_DB_*
USE_EXISTING_DB="${USE_EXISTING_DB:-0}"
if [ "$USE_EXISTING_DB" = "1" ]; then
  GLDI_DB_HOST="${GLDI_DB_HOST:-localhost}"
  GLDI_DB_USER="${GLDI_DB_USER:-u412425830_root}"
  GLDI_DB_PASS="${GLDI_DB_PASS:-Gldigital@2026}"
  GLDI_DB_NAME="${GLDI_DB_NAME:-u412425830_gldigital}"
  echo "Usando base de datos existente: $GLDI_DB_NAME en $GLDI_DB_HOST"
else
  if [ -z "$MYSQL_ROOT_PASS" ]; then
    echo -n "Contraseña de MySQL root (Enter si no tiene): "
    read -s MYSQL_ROOT_PASS
    echo
  fi
  if [ -z "$GLDI_DB_PASS" ]; then
    echo -n "Contraseña para el usuario gldigital (base de datos): "
    read -s GLDI_DB_PASS
    echo
  fi
  GLDI_DB_HOST="localhost"
  GLDI_DB_USER="gldigital"
  GLDI_DB_NAME="gldigital"
fi
if [ -z "$GLDI_JWT_SECRET" ]; then
  echo -n "JWT_SECRET (frase larga, mínimo 16 caracteres): "
  read -s GLDI_JWT_SECRET
  echo
fi

# 2) Crear base de datos y usuario (solo si no usamos BD existente)
if [ "$USE_EXISTING_DB" != "1" ]; then
  echo "Creando base de datos..."
  if [ -n "$MYSQL_ROOT_PASS" ]; then
    mysql -u root -p"$MYSQL_ROOT_PASS" -e "
      CREATE DATABASE IF NOT EXISTS gldigital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      CREATE USER IF NOT EXISTS 'gldigital'@'localhost' IDENTIFIED BY '$GLDI_DB_PASS';
      GRANT ALL PRIVILEGES ON gldigital.* TO 'gldigital'@'localhost';
      FLUSH PRIVILEGES;
    "
  else
    mysql -u root -e "
      CREATE DATABASE IF NOT EXISTS gldigital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      CREATE USER IF NOT EXISTS 'gldigital'@'localhost' IDENTIFIED BY '$GLDI_DB_PASS';
      GRANT ALL PRIVILEGES ON gldigital.* TO 'gldigital'@'localhost';
      FLUSH PRIVILEGES;
    "
  fi
  echo "Base de datos lista."
fi

# 3) Clonar o actualizar repo
if [ ! -d "$WEB_ROOT" ]; then
  mkdir -p /var/www
  git clone "$REPO_URL" "$WEB_ROOT"
  cd "$WEB_ROOT"
else
  cd "$WEB_ROOT"
  git pull || true
fi

# 4) Crear .env (contraseña en URL: @ -> %40 para que no rompa)
GLDI_DB_PASS_URL=$(printf '%s' "$GLDI_DB_PASS" | sed 's/@/%40/g; s/#/%23/g; s/\%/\%25/g')
cat > apps/api/.env << ENVFILE
PORT=4000
API_PUBLIC_URL=$API_PUBLIC_URL
DATABASE_URL="mysql://${GLDI_DB_USER}:${GLDI_DB_PASS_URL}@${GLDI_DB_HOST}:3306/${GLDI_DB_NAME}"
JWT_SECRET=$GLDI_JWT_SECRET
CORS_ORIGIN=$API_PUBLIC_URL
STORAGE_MODE=local
ENVFILE
echo "Archivo .env creado."

# 5) Instalar y build (shared primero, luego api, luego web)
npm install
cd apps/api
npx prisma generate
npx prisma db push
cd "$WEB_ROOT"
npm run build --workspace @gldigital/shared
npm run build --workspace @gldigital/api
VITE_API_URL= npm run build --workspace @gldigital/web
echo "Build listo."

# 6) PM2
pm2 delete gldigital-api 2>/dev/null || true
pm2 start apps/api/dist/server.js --name gldigital-api --cwd "$WEB_ROOT/apps/api"
pm2 save
echo "PM2 configurado. Ejecutá 'pm2 startup' si es la primera vez."

# 7) Nginx
cat > /etc/nginx/sites-available/gldigital << 'NGINX'
server {
    listen 80;
    server_name 187.77.61.37;

    root /var/www/gldigital/apps/web/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/gldigital /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "Nginx configurado."

echo ""
echo "=== Listo. Abrí http://187.77.61.37 en el navegador ==="
