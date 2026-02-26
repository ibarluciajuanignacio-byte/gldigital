# Cómo arrancar GLdigital (primera vez o desde cero)

Seguí estos pasos en orden. Así la app funciona con MySQL sin errores 500.

---

## 1. Base de datos MySQL

- Tené **MySQL** corriendo (XAMPP, WAMP, o servicio de MySQL).
- Creá la base **`gldigital`** (en phpMyAdmin: Nueva → nombre `gldigital` → crear).

---

## 2. Variables de entorno de la API

En la carpeta **`apps/api`** creá o editá el archivo **`.env`** con al menos:

```env
DATABASE_URL="mysql://root:@localhost:3306/gldigital"
PORT=4000
JWT_SECRET=un-secreto-largo-de-al-menos-16-caracteres
CORS_ORIGIN=http://localhost:5173
```

- Si tu MySQL tiene contraseña: `mysql://root:TU_PASSWORD@localhost:3306/gldigital`
- El resto de variables (STORAGE_MODE, etc.) pueden quedar por defecto.

---

## 3. Sincronizar la base con el código (solo una vez o al cambiar el schema)

En una terminal, **desde la carpeta del proyecto** (donde está `package.json`):

```bash
cd apps/api
npx prisma db push
npx prisma generate
```

- **`db push`**: crea/actualiza todas las tablas en MySQL (proveedores, órdenes de compra, dispositivos, técnicos, reparaciones, revendedores, etc.).
- **`prisma generate`**: genera el cliente que usa la API. Si da error **EPERM**, cerrá la API y cualquier proceso que use el proyecto y volvé a ejecutar solo `npx prisma generate`.

Podés usar el script: `npm run db:sync` (desde `apps/api`).

---

## 4. Arrancar la app

Desde la **raíz del proyecto** (carpeta `Gldigital`):

```bash
npm run dev
```

Eso levanta la **API** (puerto 4000) y el **frontend** (puerto 5173). La API hace `prisma generate` al arrancar por si faltaba.

- Primera vez: abrí **https://localhost:5173** (o http según tu config).
- En el login se ejecuta el **bootstrap** (admin, revendedor demo, estados de equipo, categorías). Usuario: **admin@gldigital.local**, contraseña: **admin123**.

---

## 5. Flujo de demo recomendado

1. **Login** con admin → bootstrap se ejecuta solo.
2. **Proveedores** → Crear proveedor.
3. **Compras** → Nueva orden de compra (elegir proveedor) → Entrar a la orden → Agregar ítems (modelo, memoria, color) → Recepción por IMEI (escanear o cargar IMEI) para dar de alta equipos.
4. **Stock** → Ver equipos (sellados/usados/en técnico).
5. **Técnicos** → Crear técnico → En Stock, pestaña "En técnico", asignar equipos a técnicos (motivo, anotaciones, precio).
6. **Revendedores** → Crear revendedor.
7. **Consignaciones** → Asignar equipo a revendedor (elegir equipo disponible y revendedor).

Si algo falla, en la **terminal de la API** vas a ver el error concreto (gracias al manejo de errores global). Revisá que MySQL esté corriendo y que hayas ejecutado `db push` y `prisma generate`.
