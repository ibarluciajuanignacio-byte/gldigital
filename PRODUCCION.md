# Desplegar GLdigital en gldigital.stgrandesligas.com

Pasos para subir el proyecto y la base MySQL local a producción.

---

## 1. Build para producción

Desde la **raíz del proyecto** (carpeta `Gldigital`):

```bash
npm run build:deploy
```

Eso hace:
- Build del frontend (con misma-origen para la API)
- Build de la API (TypeScript → `apps/api/dist`)
- Copia del frontend a `apps/api/dist/public`

Al final tenés todo en **`apps/api/dist`**: el servidor Node y la carpeta `public` con el sitio. Eso es lo que se sube al servidor.

---

## 2. Variables de entorno en el servidor

En el servidor donde va a correr la app (Node), creá un archivo **`.env`** dentro de la carpeta de la API (o donde esté `dist/server.js`) con:

```env
NODE_ENV=production
PORT=4000

DATABASE_URL="mysql://USUARIO:CONTRASEÑA@HOST:3306/NOMBRE_BD"
JWT_SECRET=una_frase_larga_y_aleatoria_de_al_menos_20_caracteres
CORS_ORIGIN=https://gldigital.stgrandesligas.com

STORAGE_MODE=local
```

- **DATABASE_URL**: si en el hosting tenés MySQL, usá ese usuario, contraseña, host y nombre de BD. Si primero subís la base local, creá una BD en el hosting y después importás el dump (ver punto 3).
- **JWT_SECRET**: generá una clave larga y aleatoria solo para producción.
- **CORS_ORIGIN**: la URL pública del sitio, **https://gldigital.stgrandesligas.com** (sin barra final).

Podés usar como plantilla **`apps/api/env.production.ejemplo`**.

---

## 3. Subir la base MySQL local

### Opción A: Exportar desde tu PC e importar en el hosting

1. **Exportar desde local** (XAMPP / MySQL en tu PC):
   - En phpMyAdmin: elegí la base **gldigital** → pestaña **Exportar** → método rápido, formato SQL → Exportar. Guardás el `.sql`.

2. **En el hosting**:
   - Creá una base MySQL nueva (ej. `tuusuario_gldigital`) y anotá usuario, contraseña y host.
   - En phpMyAdmin del hosting: Importar → elegir el archivo `.sql` → Ejecutar.

3. En el `.env` del servidor poné **DATABASE_URL** con ese usuario, contraseña, host y nombre de la BD.

### Opción B: El hosting ya tiene la misma base

Si ya tenés MySQL en el servidor con la misma estructura (mismas tablas), solo configurá **DATABASE_URL** en el `.env` con los datos de ese MySQL.

Después de la primera vez, en el servidor podés ejecutar (si cambió el schema):

```bash
cd apps/api
npx prisma db push
npx prisma generate
```

(En producción suele correrse el build que ya trae el cliente generado; `db push` solo si agregaste tablas o columnas nuevas.)

---

## 4. Subir el proyecto al servidor

- Subí la carpeta **`apps/api`** al servidor (con **`dist`** y todo su contenido, incluido `dist/public`).
- O subí todo el repo y en el servidor ejecutá `npm run build:deploy` y luego arrancá solo la API.

Estructura mínima en el servidor:

```
apps/api/
  dist/
    server.js
    public/       ← index.html, assets/, etc.
    ...
  .env            ← variables de producción
  node_modules/  ← npm install --production en el servidor o subir
  package.json
```

En el servidor:

```bash
cd apps/api
npm install --production
node dist/server.js
```

O con PM2 / systemd para que quede siempre corriendo:

```bash
pm2 start dist/server.js --name gldigital
```

---

## 5. Dominio y HTTPS (gldigital.stgrandesligas.com)

- En el panel del hosting (cPanel, Plesk, etc.): apuntá el dominio **gldigital.stgrandesligas.com** al servidor donde corre Node (o al proxy inverso, si usás Nginx/Apache delante).
- Activá **SSL/HTTPS** para ese dominio (Let's Encrypt suele estar en el mismo panel). Con HTTPS y certificado válido la cámara del escáner IMEI va a funcionar bien en los celulares.

Si usás **Nginx** como proxy:

- Proxy de `https://gldigital.stgrandesligas.com` hacia `http://127.0.0.1:4000` (donde escucha la API).
- El usuario entra a **https://gldigital.stgrandesligas.com** y ve el sitio; las llamadas a `/api` las resuelve Nginx al mismo backend.

---

## 6. Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | `npm run build:deploy` en la raíz |
| 2 | Crear `.env` en el servidor (DATABASE_URL, JWT_SECRET, CORS_ORIGIN) |
| 3 | Exportar BD local → importar en MySQL del hosting (o usar la del hosting) |
| 4 | Subir `apps/api` (con `dist/`) y hacer `npm install --production`; arrancar con `node dist/server.js` o PM2 |
| 5 | Dominio gldigital.stgrandesligas.com apuntando al servidor + HTTPS |

Con eso el proyecto queda listo para producción en **https://gldigital.stgrandesligas.com** usando la base que subas desde tu MySQL local.

---

## 7. Usuario y contraseña de acceso (login)

**Admin (acceso completo):**
- **Email:** `admin@gldigital.local`
- **Contraseña:** `admin123`

**Revendedor demo (solo si lo necesitás):**
- **Email:** `revendedor@gldigital.local`
- **Contraseña:** `revendedor123`

### Cómo se crean

Al **entrar a la pantalla de login y hacer clic en Iniciar sesión**, la app primero llama a **`POST /auth/bootstrap`**. Ese endpoint:

- Crea o actualiza el usuario admin con la contraseña `admin123`.
- Crea estados de equipo, categorías, etc.
- Luego se hace el login con el email y contraseña que pusiste.

Por eso **la primera vez en producción** tenés que:

1. Abrir **https://gldigital.stgrandesligas.com** (o la URL donde esté el front).
2. Escribir **admin@gldigital.local** y **admin123** (o dejarlos si ya vienen cargados).
3. Clic en **Iniciar sesión**.

Si la API no responde (URL mal configurada, CORS, servidor caído), el bootstrap y el login fallan y ves “No fue posible iniciar sesión”. Revisá que la API esté en marcha y que `CORS_ORIGIN` en el servidor sea exactamente la URL del sitio (ej. `https://gldigital.stgrandesligas.com`).
