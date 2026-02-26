# Subir el frontend (web) a Hostinger – public_html

No subas la carpeta `apps/web` tal cual. El `index.html` que ves ahí usa `/src/main.tsx`, que es código fuente y el navegador no lo puede ejecutar. Hay que **generar el build** y subir **solo la carpeta resultante**.

---

## Pasos

### 1. Generar el build (en tu PC)

Desde la **raíz del proyecto** (la carpeta donde está `package.json` con `"name": "gldigital"`):

```bash
npm run build --workspace @gldigital/web
```

O entrando a la carpeta web:

```bash
cd apps/web
npm run build
```

Eso crea la carpeta **`apps/web/dist`** con el sitio listo para producción (index.html + JS y CSS compilados).

### 2. Qué subir a Hostinger

Subí **todo el contenido** de la carpeta **`apps/web/dist`** a **`public_html`**.

Es decir: dentro de `public_html` deben quedar:

- `index.html` (en la raíz de public_html)
- carpeta `assets/` (con los .js y .css)

No subas la carpeta `dist` como carpeta; subí **lo que hay dentro** de `dist`.

### 3. URL de la API (importante)

El frontend llama a la API. Por defecto usa `http://localhost:4000`. En producción tenés que decirle la URL real de tu API.

**Si la API va a estar en Hostinger** (mismo dominio u otro subdominio), antes de hacer el build creá en `apps/web` un archivo **`.env.production`** con:

```env
VITE_API_URL=https://tu-dominio-api.com
```

Reemplazá por la URL real (ej. `https://api.gldigital.stgrandesligas.com` o la que te dé Hostinger). Luego volvé a ejecutar:

```bash
npm run build --workspace @gldigital/web
```

y subí de nuevo el contenido de `apps/web/dist` a `public_html`.

---

## Resumen

| Qué hacer | Dónde |
|-----------|--------|
| Build del frontend | En tu PC: `npm run build --workspace @gldigital/web` |
| Carpeta a subir | **Contenido** de `apps/web/dist` |
| Destino en Hostinger | **public_html** (index.html y assets/ en la raíz) |
| API en producción | Crear `apps/web/.env.production` con `VITE_API_URL=https://...` y volver a hacer build |

Así evitás el 403 y el sitio carga; el login y los datos dependerán de que la API esté corriendo y accesible en la URL que pongas en `VITE_API_URL`.
