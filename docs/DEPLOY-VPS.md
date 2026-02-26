# Desplegar GLdigital en el VPS (Hostinger – Ubuntu 24.04)

Tu VPS: **187.77.61.37** (acceso: `ssh root@187.77.61.37`).

No tenés que "subir el proyecto a mano" cada vez: usás **Git** (clonar una vez, después `git pull` + rebuild).

---

## 1. Conectarte al VPS

```bash
ssh root@187.77.61.37
```

(Te pide la contraseña root que ves en el panel de Hostinger.)

---

## 2. Preparar el servidor (solo la primera vez)

Ejecutá estos comandos en el VPS.

### Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v   # debe ser v20.x
```

### MySQL

```bash
apt-get update && apt-get install -y mysql-server
systemctl start mysql
systemctl enable mysql
mysql_secure_installation   # opcional: contestar las preguntas
```

Crear base y usuario para la app:

```bash
mysql -u root -p
```

En MySQL:

```sql
CREATE DATABASE gldigital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gldigital'@'localhost' IDENTIFIED BY 'PONER_CONTRASEÑA_SEGURA';
GRANT ALL PRIVILEGES ON gldigital.* TO 'gldigital'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Nginx (reversa proxy + servir el front)

```bash
apt-get install -y nginx
```

### PM2 (para que la API quede siempre corriendo)

```bash
npm install -g pm2
```

---

## 3. Subir el proyecto (primera vez)

**Opción A – Si tenés el repo en GitHub/GitLab**

En el VPS:

```bash
apt-get install -y git
cd /var/www
git clone https://github.com/TU_USUARIO/TU_REPO.git gldigital
cd gldigital
```

Si el proyecto está en una carpeta tipo `Gldigital` dentro del repo, entrá a esa carpeta (ej. `cd Gldigital`).

**Opción B – Subir desde tu PC con rsync**

Desde tu PC (PowerShell o Git Bash), en la carpeta del proyecto (donde está `package.json` del monorepo):

```bash
# Reemplazá Gldigital por la ruta real de tu proyecto
scp -r C:\Users\Juani\Desktop\Proyectos\GLdigital\Gldigital root@187.77.61.37:/var/www/gldigital
```

O con rsync si lo tenés:

```bash
rsync -avz --exclude node_modules --exclude .env ./Gldigital/ root@187.77.61.37:/var/www/gldigital/
```

Luego en el VPS creás el `.env` a mano (ver paso 4).

---

## 4. Configurar la API en el VPS

En el VPS, dentro de la carpeta del proyecto (ej. `/var/www/gldigital` o `/var/www/gldigital/Gldigital`):

```bash
cd /var/www/gldigital   # o la ruta donde esté el package.json del monorepo
npm install
```

Crear el `.env` de la API (copiar desde ejemplo y editar):

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

Valores importantes para producción:

- `PORT=4000`
- `API_PUBLIC_URL=https://tudominio.com` (o `http://187.77.61.37` si aún no tenés dominio)
- `DATABASE_URL="mysql://gldigital:PONER_CONTRASEÑA_SEGURA@localhost:3306/gldigital"`
- `JWT_SECRET=` una frase larga y aleatoria (mínimo 16 caracteres)
- `CORS_ORIGIN=https://tudominio.com` (o la URL del front)
- `STORAGE_MODE=local` (o `s3` si configuraste S3)

Guardar: Ctrl+O, Enter, Ctrl+X.

Aplicar Prisma y generar cliente:

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
# Si no tenés migraciones: npx prisma db push
cd ../..
```

---

## 5. Build del frontend (producción)

El front debe llamar a la API en la misma URL (mismo origen). Build con:

```bash
cd /var/www/gldigital
VITE_API_URL= npm run build --workspace @gldigital/web
```

(Eso deja `VITE_API_URL` vacío para que el front use `/api` en la misma URL.)

El build queda en `apps/web/dist`. La API no sirve ese build; lo sirve Nginx.

---

## 6. Build de la API

```bash
npm run build --workspace @gldigital/api
```

---

## 7. Arrancar la API con PM2

La API debe correr con el directorio de trabajo en `apps/api` (para .env y Prisma):

```bash
cd /var/www/gldigital
pm2 start apps/api/dist/server.js --name gldigital-api --cwd /var/www/gldigital/apps/api
pm2 save
pm2 startup   # seguir las instrucciones para que arranque al reiniciar
```

---

## 8. Configurar Nginx

Crear sitio (reemplazá `tudominio.com` por tu dominio o usá la IP):

```bash
nano /etc/nginx/sites-available/gldigital
```

Contenido:

```nginx
server {
    listen 80;
    server_name tudominio.com 187.77.61.37;

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
```

Activar y recargar:

```bash
ln -s /etc/nginx/sites-available/gldigital /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## 9. Actualizar el proyecto (cuando cambies código)

No hace falta “subir el proyecto de vuelta” a mano. En el VPS:

```bash
cd /var/www/gldigital
git pull
npm install
npm run build --workspaces
pm2 restart gldigital-api
```

Si subís solo el front: `VITE_API_URL= npm run build --workspace @gldigital/web` y no hace falta reiniciar PM2.  
Si cambias algo de la API o de Prisma: build de api, `npx prisma migrate deploy` si hay migraciones nuevas, y `pm2 restart gldigital-api`.

---

## Resumen rápido

| Qué querés hacer     | Dónde   | Acción |
|----------------------|--------|--------|
| Conectarte           | Tu PC  | `ssh root@187.77.61.37` |
| Primera instalación  | VPS    | Node 20, MySQL, Nginx, PM2; clonar/subir proyecto; .env; prisma; build; PM2 start; Nginx config |
| Actualizar código    | VPS    | `git pull`, `npm install`, `npm run build --workspaces`, `pm2 restart gldigital-api` |

Si más adelante agregás dominio o HTTPS (certificado SSL), se puede sumar en Nginx (por ejemplo con Let's Encrypt).
