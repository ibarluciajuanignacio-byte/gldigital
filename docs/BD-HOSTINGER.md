# Base de datos en Hostinger (phpMyAdmin)

Si ya creaste la base en el panel de Hostinger (Bases de datos / phpMyAdmin), usá esos datos y **no crees otra** en el VPS.

## Datos de tu BD (según tu captura)

| Dato        | Valor              |
|------------|---------------------|
| Base de datos | `u412425830_gldigital` |
| Usuario       | `u412425830_root`      |
| Contraseña    | `Gldigital@2026`       |

## ¿Dónde corre la app?

- **Si la app corre en el VPS (187.77.61.37)** y la BD está en **Hostinger hosting compartido** (otro servidor): en el panel de Hostinger entrá a **Bases de datos → MySQL remoto** y agregá la IP del VPS `187.77.61.37` para permitir conexiones desde el VPS. El **host** de MySQL te lo muestra Hostinger (ej. `localhost` si está en el mismo plan, o un host tipo `mysql.xxx.hostinger.com` para acceso remoto).
- **Si la app y phpMyAdmin están en el mismo plan** (mismo servidor): usá `GLDI_DB_HOST=localhost`.

## Usar la BD existente en el deploy

En el VPS, antes de ejecutar el script:

```bash
export USE_EXISTING_DB=1
export GLDI_DB_HOST=localhost
export GLDI_DB_USER=u412425830_root
export GLDI_DB_PASS='Gldigital@2026'
export GLDI_DB_NAME=u412425830_gldigital
export GLDI_JWT_SECRET=una_frase_larga_minimo_16_caracteres
bash scripts/deploy-vps.sh
```

Si la BD está en **otro servidor** (acceso remoto), reemplazá `GLDI_DB_HOST=localhost` por el host que te dé Hostinger (ej. `export GLDI_DB_HOST=mysql123.hostinger.com`).

La contraseña tiene `@`; el script la convierte a `%40` en la URL de conexión.
