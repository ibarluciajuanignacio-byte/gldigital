# Una sola URL: entrar a https://gldigital.stgrandesligas.com y loguearte

El proyecto quedó listo para **un solo despliegue**: la API sirve el frontend. Una URL, login y CRM funcionando.

---

## Qué tenés que hacer

### 1. Build para producción (en tu PC)

En la raíz del proyecto:

```bash
npm run build:deploy
```

Eso genera **apps/api/dist/** con la API y el frontend adentro (carpeta **public/**). Ese dist es lo que se ejecuta en el servidor.

### 2. Subir a un lugar que ejecute Node (ej. Render.com)

En **Hostinger** (plan común) no se ejecuta Node. Necesitás un servicio que sí lo haga. La opción más rápida y gratuita es **Render.com**:

1. Entrá a **https://render.com** → Registro gratis.
2. **New** → **Web Service**.
3. Conectá tu **GitHub** (subí el repo de Gldigital) o subí el proyecto a mano.
4. Configurá:
   - **Build command:**  
     `npm install && npx prisma generate --schema=apps/api/prisma/schema.prisma && npm run build:deploy`
   - **Start command:**  
     `node apps/api/dist/server.js`
   - **Root directory:** dejalo vacío (raíz del repo).
5. En **Environment** agregá:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = si tenés MySQL en Hostinger, poné la URL. Si no: `file:./data.db` (Render usa SQLite en un disco efímero; para demo alcanza).
   - `JWT_SECRET` = una frase larga y aleatoria (ej. 20 caracteres).
   - `CORS_ORIGIN` = la URL que te dé Render (ej. `https://gldigital-xxx.onrender.com`) o `*`.
6. **Create Web Service**. Te dan una URL tipo `https://gldigital-xxx.onrender.com`.

### 3. Crear el usuario admin (una sola vez)

Cuando el servicio esté en línea, abrí en el navegador o Postman:

**POST** `https://tu-url.onrender.com/auth/bootstrap`

(sin body, o body vacío)

Eso crea el usuario admin y datos iniciales. Después entrás con:

- **Email:** `admin@gldigital.local`
- **Contraseña:** `admin123`

### 4. Usar tu dominio (opcional)

Para que en vez de `https://gldigital-xxx.onrender.com` entres por **https://gldigital.stgrandesligas.com**:

1. En **Render** → tu Web Service → **Settings** → **Custom Domain** → agregá `gldigital.stgrandesligas.com`.
2. En **Hostinger** (o donde tengas el DNS del dominio): creá un registro **CNAME** para `gldigital` (o el subdominio que uses) apuntando a la URL que te indique Render (ej. `xxx.onrender.com`).

Cuando el DNS propague, entrás a **https://gldigital.stgrandesligas.com**, te logueás y mostrás el CRM.

---

## Resumen

| Paso | Acción |
|------|--------|
| 1 | `npm run build:deploy` en la PC |
| 2 | Crear Web Service en Render con ese build y start command |
| 3 | Variables: NODE_ENV, DATABASE_URL, JWT_SECRET, CORS_ORIGIN |
| 4 | POST /auth/bootstrap para crear admin |
| 5 | (Opcional) Dominio gldigital.stgrandesligas.com → Render |

Una vez hecho eso, entrás a la URL (Render o tu dominio), **admin@gldigital.local** / **admin123**, y listo.
