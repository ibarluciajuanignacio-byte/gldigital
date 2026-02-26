# Entrar en producción – rápido

El login no funciona si la **API no está en línea**. El frontend llama a la API para iniciar sesión; si esa URL no existe, siempre va a fallar.

---

## Paso 1: Dejar creado el usuario admin en tu MySQL (Hostinger)

Así, cuando la API esté en línea, ya vas a poder entrar.

1. En **Hostinger** → Bases de datos MySQL → anotá: **host** (ej. `mysql123.hostinger.com`), **usuario**, **contraseña**, **nombre de la BD** (ej. `u412425830_gldigital`).

2. En tu PC, en la carpeta **`apps/api`** editá el archivo **`.env`** y poné la URL de esa base (solo para este paso):
   ```env
   DATABASE_URL="mysql://USUARIO:CONTRASEÑA@HOST:3306/NOMBRE_BD"
   ```
   Ejemplo:
   ```env
   DATABASE_URL="mysql://u412425830_juani:miclave@mysql123.hostinger.com:3306/u412425830_gldigital"
   ```

3. En la terminal, desde la carpeta **`apps/api`**:
   ```bash
   npx tsx scripts/create-admin.ts
   ```
   Deberías ver: "Listo. Usuario admin creado/actualizado."

4. **Credenciales para cuando la API esté en línea:**
   - **Email:** `admin@gldigital.local`
   - **Contraseña:** `admin123`

---

## Paso 2: Poner la API en línea (para que el login funcione)

El frontend necesita una URL de API que responda. Dos opciones:

### Opción A: Hostinger con Node.js

1. En **hPanel** → buscá **"Node.js"** o **"Aplicaciones Node.js"**.
2. Si está: creá una app Node, señalá la carpeta del proyecto (o la API), comando de inicio algo como: `node dist/server.js` (desde la carpeta de la API). Configurá `DATABASE_URL` con la misma URL de MySQL de Hostinger.
3. Te van a dar una URL (ej. `https://api.gldigital.stgrandesligas.com`). Esa es tu URL de API.

### Opción B: Render.com (gratis, sin tocar Hostinger)

1. Entrá a **https://render.com** y creá cuenta.
2. **New** → **Web Service**.
3. Conectá tu repo de GitHub (o subí el proyecto).
4. Configurá:
   - **Build command:** `npm install && npx prisma generate --schema=apps/api/prisma/schema.prisma && npm run build --workspace @gldigital/api`
   - **Start command:** `node apps/api/dist/server.js`
   - **Root directory:** (dejá vacío si el repo es la raíz del proyecto)
5. En **Environment** agregá:
   - `DATABASE_URL` = la misma URL de MySQL de Hostinger (la del paso 1). Así la API en Render usa tu misma base.
6. Deploy. Te dan una URL tipo `https://gldigital-api.onrender.com`. Esa es tu URL de API.

---

## Paso 3: Decirle al frontend dónde está la API

1. En tu PC, en **`apps/web/.env.production`** poné la URL real de la API (la de Hostinger o la de Render):
   ```env
   VITE_API_URL=https://tu-url-api-aqui
   ```
2. Volvé a generar el build:
   ```bash
   npm run build --workspace @gldigital/web
   ```
3. Subí de nuevo el **contenido** de **`apps/web/dist`** a **public_html** en Hostinger.

Después de eso, al entrar a tu sitio y poner **admin@gldigital.local** / **admin123** debería dejar entrar (porque el usuario ya está en la BD y la API ya responde).
