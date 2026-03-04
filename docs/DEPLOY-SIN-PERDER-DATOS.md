# Desplegar sin tocar los datos de producción

## Por qué los datos de producción no se pierden

- **Git / GitHub solo guardan código** (archivos del proyecto). No guardan la base de datos.
- **Cada entorno tiene su propia base de datos:**
  - En tu PC: la base que usa `apps/api/.env` (DATABASE_URL) → ahí están tus datos de prueba.
  - En el servidor: la base que usa el `.env` del servidor → ahí están los datos del cliente.
- Al hacer **push** a GitHub solo subís código. Al hacer **pull** en el servidor solo se actualizan archivos del repo. La base de datos del servidor **no se reemplaza ni se mezcla** con la de tu PC.

Los archivos `.env` están en `.gitignore`, así que **nunca se suben**. En el servidor se usa el `.env` de producción (con la URL de la base del cliente).

## Qué hacer al actualizar en el servidor

1. **En el servidor**, hacer pull del repo:
   ```bash
   cd /ruta/del/proyecto
   git pull origin main   # o la rama que uses
   ```
   Esto solo actualiza código. La base de datos de producción no se toca.

2. **No ejecutar en producción:**
   - `npx prisma migrate reset` (borra todo y reaplica migraciones).
   - `npx prisma db push --force-reset` (puede resetear).
   - Cargar dumps o seeds de tu entorno local.

3. **Sí podés ejecutar** (si usan migraciones):
   - `npx prisma migrate deploy` — aplica migraciones pendientes sin borrar datos.
   - O si no usan migraciones y el schema no cambió, solo reiniciar la API y el front.

4. Reinstalar dependencias y reconstruir si hace falta:
   ```bash
   npm install
   npm run build   # o el comando de build del monorepo
   ```
   Reiniciar la API y el servicio del front (PM2, systemd, etc.).

## Resumen

| Acción              | ¿Toca la base de producción? |
|---------------------|------------------------------|
| Push a GitHub       | No                          |
| Pull en el servidor | No                          |
| migrate deploy      | No (solo añade cambios)      |
| migrate reset       | Sí (borra todo) — no usar en prod |

Con este flujo, los datos que el cliente cargó en producción siguen ahí; solo se actualiza el código de la app.
