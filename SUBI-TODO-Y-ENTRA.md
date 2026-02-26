# Subir todo y entrar – mínimo indispensable

Usuario y contraseña ya están en el código; cuando la API esté en línea los creás con un solo paso.

---

## Por qué no alcanza con “subir a Hostinger”

El login lo valida la **API** (Node). Si solo subís archivos a una carpeta (public_html), nadie ejecuta esa API. Tiene que haber un **servicio que ejecute Node**. Por eso hace falta Render (o Hostinger solo si tu plan tiene Node.js).

---

## Opción que siempre funciona (Render, gratis)

1. **Subí el proyecto a GitHub** (si no está ya).

2. Entrá a **https://render.com** → cuenta gratis → **New** → **Web Service**.

3. Conectá el repo de Gldigital.

4. **Build command:**
   ```bash
   npm install && npx prisma generate --schema=apps/api/prisma/schema.prisma && npm run build:deploy
   ```

5. **Start command:**
   ```bash
   node apps/api/dist/server.js
   ```

6. **Environment** (solo estas 4):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = tu MySQL de Hostinger (ej. `mysql://usuario:pass@mysqlXX.hostinger.com:3306/u123_gldigital`)
   - `JWT_SECRET` = cualquier frase de 20+ caracteres (ej. `gldigital_secreto_2024`)
   - `CORS_ORIGIN` = `*`

7. **Create Web Service**. Te dan una URL (ej. `https://gldigital-xxxx.onrender.com`).

8. Cuando esté en línea, en el navegador abrí (o Postman, POST):
   ```
   https://tu-url.onrender.com/auth/bootstrap
   ```
   Eso crea el admin. Después entrás a esa misma URL, login:
   - **Email:** `admin@gldigital.local`
   - **Contraseña:** `admin123`

9. **(Opcional)** Para usar **gldigital.stgrandesligas.com**: en Render → Settings → Custom Domain → agregá ese dominio. En Hostinger (DNS) poné un CNAME de `gldigital` a la URL que te indique Render.

---

## Resumen

| Qué hacés | Dónde |
|-----------|--------|
| Subís el proyecto | GitHub (y Render lo toma de ahí) |
| Configurás 4 variables | NODE_ENV, DATABASE_URL, JWT_SECRET, CORS_ORIGIN |
| Una vez desplegado | Abrís /auth/bootstrap (POST) para crear el admin |
| Entrás | Misma URL, `admin@gldigital.local` / `admin123` |

No hace falta comprimir ni subir “todo de vuelta” a Hostinger para el login: el sitio y el login quedan en la URL de Render (o en tu dominio si configurás el CNAME).
