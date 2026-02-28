# MySQL en el VPS – Paso a paso (principiante)

Todo se hace **en la terminal del VPS** (la que abrís por SSH o desde el panel de Hostinger).

---

## Paso 1: Entrar a MySQL

En la terminal del VPS escribí:

```bash
mysql -u root -p
```

- Te va a pedir **contraseña**.
- Si **nunca** configuraste una para `root` de MySQL, probá apretar **Enter** (contraseña vacía).
- Si no te deja entrar, en el siguiente paso te digo cómo resetear la contraseña de root.

Cuando entres, el prompt va a cambiar a algo como `mysql>`.

---

## Paso 2: Crear la base y el usuario (dentro de MySQL)

**Copiá y pegá todo este bloque** en la terminal (con el prompt `mysql>`) y después apretá Enter:

```sql
CREATE DATABASE IF NOT EXISTS gldigital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'gldigital'@'localhost' IDENTIFIED BY 'SimplePass123';
GRANT ALL PRIVILEGES ON gldigital.* TO 'gldigital'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Qué hace cada línea:

- **CREATE DATABASE gldigital**: crea la base donde va a guardar la app (si ya existe, no hace nada).
- **CREATE USER 'gldigital'**: crea el usuario que usa la app. La contraseña queda en **SimplePass123** (la vamos a poner igual en el .env).
- **GRANT ALL**: le da a ese usuario permiso total sobre la base `gldigital`.
- **FLUSH PRIVILEGES**: aplica los cambios.
- **EXIT**: salís de MySQL y volvés a la terminal normal.

Después de `EXIT` ya no deberías ver `mysql>`.

**Anotá:** usuario = `gldigital`, contraseña = `SimplePass123`, base = `gldigital`.

---

## Paso 3: Abrir el archivo .env de la API

En la misma terminal del VPS (fuera de MySQL):

```bash
nano /var/www/gldigital/apps/api/.env
```

Se abre un editor de texto. Vas a ver varias líneas; una es la de la base de datos.

---

## Paso 4: Dejar bien la línea de la base de datos

Buscá la línea que empieza con **DATABASE_URL**.

Tiene que quedar **exactamente** así (una sola línea, sin espacios raros):

```
DATABASE_URL="mysql://gldigital:SimplePass123@localhost:3306/gldigital"
```

- Si ya hay otra **DATABASE_URL**, borrala o comentala (poné `#` al principio) y dejá solo esta.
- Si la contraseña que querés usar **no** es `SimplePass123`, entonces en el Paso 2 usá esa otra contraseña en el `IDENTIFIED BY '...'` y en esta línea reemplazá `SimplePass123` por esa misma contraseña (si tiene `@` usá `%40` en su lugar, ej: `Mi@Pass` → `Mi%40Pass`).

Para guardar en nano:

1. **Ctrl+O** (la letra O)
2. **Enter**
3. **Ctrl+X** para salir

---

## Paso 5: Aplicar las tablas de la app (Prisma)

En la terminal del VPS:

```bash
cd /var/www/gldigital/apps/api
npx prisma db push
cd /var/www/gldigital
```

Eso crea/actualiza las tablas en la base `gldigital` según el código de la app.

---

## Paso 6: Reiniciar la API

```bash
pm2 restart gldigital-api
```

---

## Paso 7: Probar que todo esté bien

```bash
curl http://127.0.0.1:4000/health
```

Si responde algo como `{"ok":true}`, la API ya está conectada a MySQL.

Después probá en el navegador: **http://187.77.61.37** y crear un proveedor.

---

## Si tenés un archivo .sql (backup de la base)

Si en algún momento tenés un archivo `.sql` con datos para importar:

1. Subilo al VPS (por ejemplo a `/var/www/gldigital/`).
2. En el VPS:

```bash
mysql -u gldigital -pSimplePass123 gldigital < /var/www/gldigital/tu-archivo.sql
```

(Reemplazá `tu-archivo.sql` por el nombre real del archivo.)

Eso vuelca el contenido del archivo en la base `gldigital`.

---

## Resumen rápido

| Qué | Dónde / Cómo |
|-----|----------------|
| Base de datos | `gldigital` (en MySQL del VPS) |
| Usuario MySQL | `gldigital` |
| Contraseña MySQL | `SimplePass123` (o la que hayas puesto en el Paso 2) |
| Dónde se configura la app | Archivo `/var/www/gldigital/apps/api/.env` → línea `DATABASE_URL` |
| Reiniciar la API | `pm2 restart gldigital-api` |

La base del **hosting compartido** (phpMyAdmin, usuario u412425830_…) es **otra** base en **otro** servidor. Para esta app en el VPS usamos solo la base que creamos en el Paso 2 en el MySQL del mismo VPS.
