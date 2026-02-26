# GLdigital MVP (Fase 1)

Implementación full-stack del MVP operativo con:

- Inventario y estados de equipos, con carga inteligente: escaneo QR/código de barras (cámara) y OCR (subir foto de especificaciones para autocompletar IMEI, modelo, batería).
- Consignación con trazabilidad de movimientos.
- Deuda viva con ledger transaccional.
- Flujo de pagos reportados y confirmados/rechazados por admin.
- Chat interno en vivo (DM y grupos), mensajes de sistema, no leídos y adjuntos.

## Stack

- Web: React + Vite + TypeScript.
- API: Node.js + Express + Socket.IO + Prisma.
- DB (local): SQLite.
- Storage: local para desarrollo + S3/R2 en producción.

## Estructura

- `apps/web`: frontend.
- `apps/api`: backend, sockets y Prisma schema.
- `packages/shared`: tipos y validaciones compartidas.

## Levantar en local (rápido, sin Docker)

1. Configurar variables:
   - Copiar `apps/api/.env.example` a `apps/api/.env`.
   - Copiar `apps/web/.env.example` a `apps/web/.env`.
2. Instalar dependencias en la raíz:
   - `npm install`
3. Preparar Prisma (crea la base de datos local; el archivo por defecto es `apps/api/dev.db`, correspondiente a la base "GLdigital" en local):
   - `npm run prisma:generate`
   - `npm run prisma:push`
4. Levantar web + api:
   - `npm run dev`

La aplicación queda en:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Credenciales de bootstrap

El endpoint `/auth/bootstrap` crea usuarios demo:

- `admin@gldigital.local` / `admin123`
- `revendedor@gldigital.local` / `revendedor123`

La UI llama este bootstrap automáticamente en el login para facilitar pruebas iniciales.

## Adjuntos en local y en cloud

- Desarrollo local: usar `STORAGE_MODE=local` (por defecto en `.env.example`).
- Producción o staging: usar `STORAGE_MODE=s3` y completar credenciales R2/S3.

## Despliegue

Para subir la app a un servidor (por qué no anda solo subiendo la carpeta y qué hacer según tu hosting), ver **[DEPLOY.md](./DEPLOY.md)**.
