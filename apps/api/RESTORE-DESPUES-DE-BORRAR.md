# Restaurar el sistema después de borrar todos los datos

Si vaciaste la base de datos para que el cliente empiece de cero (sin revendedores, equipos, etc.) y **después dejó de funcionar** (error 500, no carga el dólar, no podés crear nada), es porque la app necesita **datos de sistema** que no son “de negocio”:

- **Usuario admin** para poder entrar y crear cosas.
- **Estados de equipo (DeviceStatus)** para que existan los estados que usan los equipos (Disponible, Vendido, En técnico, etc.). Sin estos, la API rechaza la creación de equipos.

El **dólar en vivo** no depende de la base: si “no funciona”, suele ser porque el **dashboard** está fallando antes (por ejemplo 500 al cargar) y la pantalla no llega a mostrar el widget.

---

## Qué hacer para dejarlo “vacío” pero funcionando

1. **Recrear el usuario admin** (por si lo borraste):
   ```bash
   cd apps/api
   npm run seed:admin
   ```
   Entrá con: `admin@gldigital.local` / `admin123`.

2. **Restaurar los estados de equipo** (imprescindible para crear equipos):
   ```bash
   cd apps/api
   npm run seed:device-statuses
   ```

3. **Reiniciar la API** y probar de nuevo: inventario, crear equipo, dashboard, dólar.

---

## Qué no borrar la próxima vez

Para “dejarlo vacío” para el cliente, **solo** borrá (o truncá) datos de negocio, por ejemplo:

- `Device` (equipos)
- `Reseller` (y opcionalmente los `User` que solo sean revendedores; **dejá al menos un User admin**)
- `Client`, `Consignment`, `Payment`, `PurchaseOrder`, `DebtLedgerEntry`, etc.

**No borres:**

- **User** con rol `admin` (al menos uno).
- **DeviceStatus** (tabla de estados de equipo).
- Tablas de configuración que use la app (por ejemplo `DeviceStatus`).

Si preferís, en vez de borrar a mano, podés usar solo el script de estados y el de admin; las tablas de negocio quedan vacías y el cliente empieza a cargar desde cero.

---

## Dejar todo en cero sin romper (solo datos de negocio)

Cuando quieras **vaciar** lo que cargaste (OC, proveedores, equipos, revendedores, clientes, etc.) pero **que todo siga funcionando**, usá:

```bash
cd apps/api
npm run clear-business-data
```

Ese script borra únicamente datos de negocio en el orden correcto. **No toca** el usuario admin, los estados de equipo (DeviceStatus), técnicos ni el catálogo de productos. Después podés entrar con `admin@gldigital.local` / `admin123` y el cliente empieza a cargar sus datos desde cero.
