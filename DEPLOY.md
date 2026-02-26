# Despliegue GLdigital

La app tiene **frontend (React)** y **API (Node)**. Según tu servidor, el flujo cambia.

---

## Por qué no anda si solo subís la carpeta del proyecto

- El **index.html** no está en la raíz del repo: está generado al hacer el **build** dentro de `apps/api/dist/public/`.
- La carpeta `dist/` no se sube a git (está en `.gitignore`), así que en el servidor no existe hasta que corrés el build.
- Por eso, si subís el proyecto tal cual, el dominio no encuentra ningún `index.html` y no anda. Tenés que **generar el build** y **subir lo que corresponda** según el tipo de hosting.

---

## Opción A: Servidor con Node (recomendado)

El backend sirve la API y también el frontend (misma URL, una sola app).

1. **En tu máquina o en el servidor** (desde la raíz del repo, ej. `Gldigital`):
   ```bash
   npm install
   npm run build:deploy
   ```
   Esto genera:
   - `apps/web/dist/` (frontend compilado)
   - `apps/api/dist/` (backend compilado)
   - y copia el frontend a `apps/api/dist/public/`

2. **Subir al servidor** todo el proyecto (o al menos `apps/api`, `apps/web`, `packages`, `package.json`, `package-lock.json`, `node_modules` si no hacés `npm install` en el servidor).

3. **En el servidor**, configurar variables de entorno (ej. `apps/api/.env`) con `NODE_ENV=production` y lo que necesites (DB, CORS, etc.).

4. **Arrancar la API** (ella sirve el sitio desde `dist/public`):
   ```bash
   cd apps/api && node dist/app.js
   ```
   O con PM2: `pm2 start apps/api/dist/app.js --name gldigital-api`

5. El **dominio** debe apuntar a este proceso (puerto 4000 o el que uses), con o sin proxy inverso (Nginx, etc.).

En este caso **no** hace falta subir nada a una carpeta “public” aparte: la API ya sirve los estáticos desde `apps/api/dist/public`.

---

## Opción B: Servidor solo estático (solo “public” con index)

Si tu hosting **no** ejecuta Node y solo sirve archivos (ej. una carpeta `public`, `www`, `htdocs`), entonces:

1. **En tu máquina** (desde la raíz del repo):
   ```bash
   npm install
   npm run build:deploy
   npm run deploy:static
   ```
   Esto deja listo el frontend en la carpeta **`deploy-public/`** en la raíz del proyecto.

2. **Subir a tu servidor** todo el **contenido** de `deploy-public/` (no la carpeta, sino lo que hay dentro: `index.html`, `assets/`, etc.) dentro de la carpeta que el hosting usa como web root (la que tiene el index).

**Importante:** con hosting solo estático solo tenés el frontend. La **API** tiene que estar en otro lado (otro servidor, otro dominio/subdominio) y en el frontend tenés que configurar la URL de esa API (variable de entorno o build con `VITE_API_URL`).

---

## Resumen

| Tipo de servidor | Qué hacer |
|------------------|-----------|
| **Con Node**     | `npm run build:deploy` → subir proyecto → en el servidor `cd apps/api && node dist/app.js`. El dominio apunta a ese proceso. No hace falta copiar nada a “public”. |
| **Solo estático**| `npm run build:deploy` y `npm run deploy:static` → subir el **contenido** de la carpeta `deploy-public/` a la carpeta pública del dominio. La API debe estar en otro servicio. |

La organización del proyecto (monorepo con `apps/web` y `apps/api`) está bien; el punto es **siempre hacer el build** y subir **lo que genera el build** (o el proyecto entero para que Node sirva desde `apps/api/dist/public`), no solo el código fuente sin build.
