# Configurar subdominio y HTTPS en el VPS

Pasos para que **gldigital.stgrandesligas.com** apunte al VPS y quede con HTTPS.

---

## 1. Crear el registro DNS del subdominio

En el panel donde gestionás el dominio **stgrandesligas.com** (Hostinger, Cloudflare, etc.):

1. Entrá a **DNS** / **Zona DNS** / **Administrar registros**.
2. Agregá un registro **A**:
   - **Nombre / Host:** `gldigital` (para que el subdominio sea `gldigital.stgrandesligas.com`). En algunos paneles se escribe el FQDN completo.
   - **Apunta a / Valor / Destino:** `187.77.61.37`
   - **TTL:** 3600 o “Automático”.
3. Guardá. La propagación puede tardar unos minutos o hasta 24–48 horas (normalmente menos de 1 hora).

Para comprobar desde tu PC (cuando propague):

```bash
ping gldigital.stgrandesligas.com
```

Debería responder con `187.77.61.37`.

---

## 2. En el VPS: deploy con el subdominio

Conectate por SSH y ejecutá el deploy indicando el subdominio:

```bash
ssh root@187.77.61.37
cd /var/www/gldigital
git pull
```

Si es la primera vez que configurás el dominio en este servidor, ejecutá el deploy con la variable de dominio:

```bash
USE_EXISTING_DB=1 \
GLDI_DOMAIN=gldigital.stgrandesligas.com \
GLDI_JWT_SECRET="tu_jwt_secret_actual" \
bash scripts/deploy-vps.sh
```

Si ya tenés el proyecto desplegado y solo querés actualizar Nginx al subdominio:

```bash
nano /etc/nginx/sites-available/gldigital
```

En la línea `server_name` poné:

```nginx
server_name gldigital.stgrandesligas.com 187.77.61.37;
```

Guardá, probá y recargá Nginx:

```bash
nginx -t && systemctl reload nginx
```

---

## 3. Activar HTTPS con Certbot

Con el subdominio ya apuntando al VPS y Nginx usando ese `server_name`:

```bash
certbot --nginx -d gldigital.stgrandesligas.com
```

- Email: uno válido para avisos de vencimiento.
- Términos: aceptar.
- Redirección HTTP → HTTPS: **Sí**.

Certbot configura el certificado y la redirección. Al terminar, entrá a:

**https://gldigital.stgrandesligas.com**

El sitio debería cargar con candado verde.

---

## Resumen rápido

| Paso | Dónde | Acción |
|------|--------|--------|
| 1 | Panel DNS de `stgrandesligas.com` | Registro **A**: nombre `gldigital` → `187.77.61.37` |
| 2 | VPS | Deploy con `GLDI_DOMAIN=gldigital.stgrandesligas.com` o editar Nginx `server_name` a mano. |
| 3 | VPS | `certbot --nginx -d gldigital.stgrandesligas.com` y elegir redirigir HTTP → HTTPS |

---

## 4. (Opcional) Que la API use la URL HTTPS

Después de activar HTTPS, si querés que mails o links generados por la API usen la URL segura:

```bash
nano /var/www/gldigital/apps/api/.env
```

Cambiá (o agregá):

```
API_PUBLIC_URL=https://gldigital.stgrandesligas.com
CORS_ORIGIN=https://gldigital.stgrandesligas.com
```

Guardá y reiniciá la API:

```bash
pm2 restart gldigital-api
```
