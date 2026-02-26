# Configurar MySQL (XAMPP local o hosting con phpMyAdmin)

El proyecto ya está preparado para usar MySQL. Solo tenés que crear la base de datos y configurar la URL.

---

## 1. Crear la base de datos

### En XAMPP (local)
1. Abrí **phpMyAdmin**: http://localhost/phpmyadmin
2. Clic en **"Nueva"** (o "Crear base de datos").
3. Nombre: **`gldigital`** (o el que quieras).
4. Cotejamiento: **utf8mb4_general_ci** (recomendado).
5. Crear.

### En el hosting
1. Entrá a **phpMyAdmin** que te dé tu hosting.
2. Creá una base de datos nueva (ej. **`gldigital`** o el nombre que te asignen).
3. Anotá: nombre de la BD, usuario, contraseña y host (a veces es `localhost`, a veces algo como `mysql.tudominio.com`).

---

## 2. Archivo `.env` de la API

En la carpeta **`apps/api`** editá (o creá) el archivo **`.env`** y poné la línea de la base de datos:

**Local (XAMPP, usuario root sin contraseña):**
```env
DATABASE_URL="mysql://root:@localhost:3306/gldigital"
```

**Local (XAMPP, usuario root con contraseña):**
```env
DATABASE_URL="mysql://root:TU_PASSWORD@localhost:3306/gldigital"
```

**Hosting (reemplazá con los datos que te den):**
```env
DATABASE_URL="mysql://USUARIO:CONTRASEÑA@HOST:3306/NOMBRE_DE_LA_BD"
```

Ejemplo:
```env
DATABASE_URL="mysql://usuario123:miclave@localhost:3306/usuario123_gldigital"
```

El resto del `.env` (PORT, JWT_SECRET, CORS_ORIGIN, etc.) dejalo como ya lo tengas.

---

## 3. Crear/actualizar tablas en MySQL (orden obligatorio)

**Cada vez que uses MySQL por primera vez o después de cambiar el schema**, ejecutá en este orden (con la API **detenida** para evitar errores EPERM en Windows):

```bash
cd apps/api
npx prisma db push
npx prisma generate
```

- **`db push`**: crea o actualiza las tablas en MySQL según `prisma/schema.prisma` (incluye Technician, RepairRecord, columnas en Device, etc.). No hace falta importar ningún .sql a mano en phpMyAdmin.
- **`prisma generate`**: regenera el cliente de Prisma que usa la API. Si no lo ejecutás después de cambiar el schema, la API puede devolver 500 al tocar dispositivos, técnicos o reparaciones.

Luego arrancá la API. Al iniciar, la API hace una prueba de conexión a la base; si falla, verás el error en consola y no arrancará.

**Si agregás modelos nuevos al schema** (por ejemplo `Technician`, `RepairRecord`) o cambiás columnas, volvé a ejecutar desde `apps/api`:
```bash
npx prisma db push
```
Así MySQL se actualiza sin borrar datos existentes (crea tablas nuevas y añade columnas faltantes).

**Alternativa (con historial de migraciones):**
```bash
cd apps/api
npx prisma migrate dev --name init
```

---

## 4. Resumen de lo que ya está modificado en el proyecto

- **`prisma/schema.prisma`**: `provider` cambiado de `"sqlite"` a `"mysql"`.
- **`apps/api/.env`**: tenés que poner la `DATABASE_URL` de MySQL (ver punto 2).  
  Si subís el proyecto sin el `.env`, en el servidor creás el `.env` con la `DATABASE_URL` del hosting.

No hace falta tocar ningún otro archivo del código para usar MySQL.

---

## 5. Si ya tenías datos en SQLite

Si tenías datos en `dev.db` (SQLite) y querés pasarlos a MySQL, no hay migración automática. Opciones:

- Exportar desde la app (si tenés alguna función de backup) e importar en la nueva BD, o
- Empezar la base MySQL vacía y cargar de nuevo (usuarios, proveedores, etc.).

Las tablas se crean vacías con `prisma db push` o `prisma migrate dev`.

---

## 6. Errores 500 al cargar Técnicos (u otras secciones)

Si la API responde **500** en rutas como `/api/technicians`, suele ser porque en MySQL **faltan tablas o columnas** que el schema de Prisma ya define (por ejemplo `Technician`, `RepairRecord`, o la columna `technicianId` en `Device`). Solución:

1. Con la API **detenida** (para evitar bloqueos en Windows), en una terminal:
   ```bash
   cd apps/api
   npx prisma db push
   npx prisma generate
   ```
2. Reiniciá la API. Si `prisma generate` da **EPERM** (operation not permitted), cerrá todo lo que use el proyecto (servidor, otra terminal, a veces el IDE) y volvé a ejecutar solo `npx prisma generate` desde `apps/api`.

**Script rápido:** desde `apps/api` podés usar `npm run db:sync` (hace push + generate). Igual conviene tener la API detenida antes.
