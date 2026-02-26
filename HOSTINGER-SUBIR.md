# Qué subir a Hostinger (administrador de archivos)

En Hostinger **solo podés subir archivos** (HTML, JS, PHP). **No se ejecuta Node.js** en el plan común. Por eso:

---

## Opción A: Solo el frontend (página estática) en Hostinger

La app **no va a funcionar completa** (login, API, etc.) porque la API necesita Node.js. Pero si solo querés que cargue la página sin errores de MIME:

1. **En tu PC** (en la carpeta del proyecto):
   ```bash
   npm run build:deploy
   ```
2. Entrá a la carpeta **`apps/api/dist/public`** (ahí quedó el build del front).
3. **Subí a Hostinger** (en `public_html` o la carpeta del dominio) **todo el contenido** de `apps/api/dist/public`:
   - `index.html`
   - la carpeta `assets/`
   - imágenes (EngineeredBigLigas.png, etc.)
   - el archivo **`.htaccess`** (debe estar en la misma carpeta que index.html).

Así se corrige el error de MIME type. Pero al hacer login va a fallar porque no hay API.

---

## Opción B: App completa (front + API)

Para que **login y todo funcione** necesitás **donde se ejecute Node.js**:

- **Hostinger VPS**: en el VPS instalás Node, subís el proyecto, configurás `.env`, ejecutás `node dist/server.js` (o con PM2). El front y la API los servís desde el mismo Node.
- **Otro servicio**: por ejemplo **Render**, **Railway** o **Fly.io**: subís el proyecto (o conectás GitHub), configurás `DATABASE_URL` con la base de Hostinger MySQL, y ellos ejecutan Node. La URL que te den (ej. `https://gldigital.onrender.com`) es la que usás en el navegador.

La base MySQL **sí puede quedarse en Hostinger**: creás la base, importás el .sql, y en la API (donde sea que corra Node) ponés `DATABASE_URL` con el usuario/contraseña/host de esa base.

---

## Resumen

| Qué querés | Dónde | Qué subir |
|------------|--------|-----------|
| Solo que no salga el error de MIME (página carga en blanco) | Hostinger → public_html | Contenido de `apps/api/dist/public` después de `npm run build:deploy`, incluyendo `.htaccess` |
| App completa (login, API, etc.) | Hostinger VPS u otro hosting con Node | Proyecto completo + en el servidor: `npm install`, `npm run build:deploy`, `.env` con `DATABASE_URL` y `CORS_ORIGIN`, luego `node dist/server.js` |

El **WebSocket localhost:8081** sale porque en desarrollo el navegador intenta conectar con Vite. Si subís el **build de producción** (paso 1 y 2 de Opción A), ese mensaje no debería aparecer porque el build no usa Vite.
