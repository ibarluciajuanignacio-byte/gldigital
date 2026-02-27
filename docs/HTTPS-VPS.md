# Activar HTTPS en el VPS desde la consola

Conectate por SSH y ejecutá estos pasos en orden.

---

## Requisito: un dominio apuntando al VPS

**Let's Encrypt solo emite certificados para nombres de dominio**, no para una IP (187.77.61.37). Necesitás tener un dominio (ej. `gldigital.com` o `app.tudominio.com`) cuyo DNS apunte a `187.77.61.37`:

- **Registro A:** `tudominio.com` → `187.77.61.37`
- O **CNAME** (subdominio): `app.tudominio.com` → `tudominio.com` y el A de `tudominio.com` → `187.77.61.37`

Cuando tengas el dominio configurado en el DNS, seguí abajo. Reemplazá `TUDOMINIO.com` por tu dominio real en todos los comandos.

---

## 1. Conectarte al VPS

```bash
ssh root@187.77.61.37
```

---

## 2. Instalar Certbot (Let's Encrypt) y el plugin de Nginx

En Ubuntu/Debian (típico en Hostinger VPS):

```bash
apt-get update
apt-get install -y certbot python3-certbot-nginx
```

---

## 3. Dejar que Certbot configure HTTPS

Certbot va a modificar tu sitio de Nginx para escuchar en el puerto 443 y usar el certificado. Ejecutá (reemplazá `TUDOMINIO.com` por tu dominio):

```bash
certbot --nginx -d TUDOMINIO.com
```

Si tu sitio en Nginx usa `server_name 187.77.61.37;`, primero tenés que cambiar eso al dominio. Editá el sitio:

```bash
nano /etc/nginx/sites-available/gldigital
```

En la línea `server_name` poné tu dominio (y opcionalmente la IP):

```nginx
server_name TUDOMINIO.com 187.77.61.37;
```

Guardá (Ctrl+O, Enter, Ctrl+X), probá Nginx y recargá:

```bash
nginx -t && systemctl reload nginx
```

Luego ejecutá Certbot:

```bash
certbot --nginx -d TUDOMINIO.com
```

- Te va a pedir un email para avisos de vencimiento (recomendado poner uno real).
- Aceptá los términos (A).
- Si pregunta “redirect HTTP → HTTPS”, elegí **Sí (2)** para forzar HTTPS.

Certbot crea el certificado y modifica el archivo de Nginx para:
- Escuchar en el puerto 443 (HTTPS)
- Usar el certificado de Let's Encrypt
- (Si elegiste redirect) Redirigir todo el tráfico HTTP a HTTPS

---

## 4. Probar y renovación automática

- Abrí en el navegador: **https://TUDOMINIO.com**
- El candado debería aparecer en verde (conexión segura).

Los certificados de Let's Encrypt duran 90 días. Certbot instala un cron/systemd timer que los renueva solo. Para comprobar:

```bash
certbot renew --dry-run
```

Si no da error, la renovación automática está bien.

---

## Resumen de comandos (con dominio ya apuntando al VPS)

```bash
# 1) Conectar
ssh root@187.77.61.37

# 2) Instalar Certbot
apt-get update && apt-get install -y certbot python3-certbot-nginx

# 3) Cambiar server_name al dominio (si todavía tenés solo la IP)
nano /etc/nginx/sites-available/gldigital
# En server_name poné: tudominio.com 187.77.61.37
nginx -t && systemctl reload nginx

# 4) Pedir certificado y activar HTTPS
certbot --nginx -d tudominio.com
# Elegir redirect HTTP → HTTPS cuando pregunte
```

Después de eso, el sitio queda servido por HTTPS desde la consola del VPS.

---

## Si solo tenés IP (sin dominio)

Let's Encrypt **no** da certificados para una IP. Opciones:

1. **Recomendado:** Registrar un dominio (gratis o barato) y apuntar su DNS a `187.77.61.37`, luego seguir la guía de arriba.
2. **Solo para pruebas:** Generar un certificado autofirmado en el VPS. La conexión se cifra, pero el navegador seguirá mostrando “No es seguro” porque no confía en ese certificado. No recomendado para producción ni para quitar el cartel de inseguro.
