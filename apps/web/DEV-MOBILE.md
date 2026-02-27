# Ver la app en el celular (misma red WiFi)

1. **En la PC:** desde `apps/web` ejecutá `npm run dev`. Anotá la IP que muestra (ej. `192.168.1.103`).

2. **En el celular:** conectado a la **misma WiFi**, abrí el navegador y entrá a:
   ```
   https://192.168.1.103:5173
   ```
   Importante: usá **https** (no http), porque el dev server usa SSL.

3. Si el navegador avisa del certificado (no seguro), tocá **Avanzar** / **Continuar de todas formas** (es un cert local de desarrollo).

4. **Si no carga** (timeout, no responde): el Firewall de Windows puede estar bloqueando. Abrí **PowerShell como Administrador** y ejecutá:
   ```powershell
   netsh advfirewall firewall add rule name="Vite Dev 5173" dir=in action=allow protocol=TCP localport=5173
   ```
   Luego probá de nuevo en el celular con `https://192.168.1.103:5173`.

5. Confirmá que el celular está en la **misma red** que la PC (misma WiFi, no datos móviles).
