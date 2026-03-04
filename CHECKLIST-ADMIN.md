# Checklist: correcciones pedidas por el admin

Una vez desplegado a producción, marcar cada ítem cuando el admin confirme que está resuelto.

## Inventario y stock

- [ ] **Borrar ítems cargados por error**: Mensaje claro si no se puede (consignación/reparación); botón Eliminar visible; texto de ayuda en vista variantes ("Elegí una variante para ver la lista y poder eliminar equipos").
- [ ] **Sucursales (Bauti / Parque Chacabuco)**: Campo Sucursal al recibir por IMEI (Compras) y en trade-in (Inventario); filtro por sucursal en Inventario.

## IMEI y datos

- [ ] **IMEI manual en móvil**: Al tocar el input IMEI se muestran dos opciones: "Escanear con cámara" e "Ingresar manualmente". Aplicado en Compras (orden y lista), e Inventario (trade-in).

## Colores por versión

- [ ] **iPhone 17 (común)**: Colores Black, White, Lavender, Mist Blue, Sage Green.
- [ ] **iPhone 17 Pro (y Pro Max)**: Colores Cosmic Orange, Deep Blue, Silver.

## Ventas / consignaciones

- [ ] **Sin duplicados en la lista de equipos**: Lista deduplicada por ID al asignar consignación.
- [ ] **Escanear IMEI al asignar**: Botón "Escanear IMEI" que abre la cámara y, al leer, selecciona ese equipo en el formulario.

## Usados (condición)

- [ ] **Cargar usados**: En Compras, recepción por IMEI acepta condición Usado (y grados A/AB); texto visible "Podés cargar equipos nuevos o usados".

---

*Implementado en local según el plan. Marcar al confirmar con el admin en producción.*
