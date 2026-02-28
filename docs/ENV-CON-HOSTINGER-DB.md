# .env usando la BD de Hostinger (phpMyAdmin)

Si creaste la base en el panel de Hostinger con estos datos:

- **Base de datos:** `u412425830_gldigital`
- **Usuario:** `u412425830_root`
- **Contraseña:** `Gldigital@2026`

## 1. Crear la base en Hostinger

En el panel, dale a **"✓ Crear"** para que se cree la base y el usuario (si todavía no lo hiciste).

## 2. Dónde corre la app

- **Si la app corre en el mismo Hostinger** (mismo plan que la BD): el host MySQL suele ser `localhost`. Usá el bloque "Mismo servidor" abajo.
- **Si la app corre en el VPS** (187.77.61.37) y la BD está en Hostinger: tenés que usar **MySQL remoto**. En el panel de Hostinger entrá a la sección de bases de datos y buscá **"MySQL remoto"** o **"Remote MySQL"**: agregá la IP del VPS (`187.77.61.37`) como host permitido. El host de conexión te lo muestra Hostinger (algo tipo `srvXX.hostinger.com` o similar). Usá el bloque "App en VPS, BD en Hostinger".

## 3. Contenido de `apps/api/.env`

La contraseña tiene `@`; en la URL hay que poner `%40` en su lugar: `Gldigital%402026`.

### Mismo servidor (app y BD en Hostinger)

```env
PORT=4000
API_PUBLIC_URL=http://187.77.61.37
DATABASE_URL="mysql://u412425830_root:Gldigital%402026@localhost:3306/u412425830_gldigital"
JWT_SECRET=una_frase_larga_aleatoria_minimo_16_caracteres
CORS_ORIGIN=http://187.77.61.37
STORAGE_MODE=local
```

### App en VPS, BD en Hostinger (MySQL remoto)

Reemplazá `HOST_MYSQL_HOSTINGER` por el host que te da Hostinger para conexión remota (ej. `mysql.hostinger.com` o el que figure en el panel):

```env
PORT=4000
API_PUBLIC_URL=http://187.77.61.37
DATABASE_URL="mysql://u412425830_root:Gldigital%402026@HOST_MYSQL_HOSTINGER:3306/u412425830_gldigital"
JWT_SECRET=una_frase_larga_aleatoria_minimo_16_caracteres
CORS_ORIGIN=http://187.77.61.37
STORAGE_MODE=local
```

Copia este contenido en `apps/api/.env` en el servidor donde corre la API.
