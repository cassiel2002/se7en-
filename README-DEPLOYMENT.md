# Guía de despliegue — Se7en Barbershop (v4.0)

Destino: **https://cassdev.com.ar/se7en/** (Hostinger, Apache).

## 1. Requisitos

- Node.js 18 o superior.
- Archivo `.env.local` (o `.env.production.local`) con las variables `VITE_FIREBASE_*`
  (ver `.env.local.example`). **No se suben al repositorio.**

## 2. Build

```bash
npm ci
npm run build
```

El resultado queda en `dist/`. El `base` de Vite es `/se7en/`, así que todos los
recursos apuntan a `/se7en/...`.

## 3. Subida a Hostinger

1. En el Administrador de archivos, abrir `public_html/se7en/` (crearla si no existe).
2. Borrar el contenido anterior de esa carpeta.
3. Subir **todo el contenido** de `dist/`, incluido el archivo oculto `.htaccess`
   (maneja las rutas de la SPA, cache de assets y cabeceras de seguridad).
4. Verificar que HTTPS esté activo en `cassdev.com.ar`.

## 4. Firebase (una sola vez por versión)

1. **Reglas de Firestore**: copiar el contenido de `firestore.rules` en
   Firebase Console → Firestore → Reglas → Publicar. La v4.0 restringe a los cajeros
   a ver solo sus propias ventas y adelantos, y a registrar operaciones solo a su nombre.
2. **Dominios autorizados**: Firebase Console → Authentication → Configuración →
   Dominios autorizados → agregar `cassdev.com.ar`.
3. **Restricción de la API key** (si existe): en Google Cloud Console → APIs y servicios →
   Credenciales, si la clave web está restringida por referente HTTP, agregar
   `https://cassdev.com.ar/*`.

No se necesitan índices compuestos nuevos: las consultas agregadas en v4.0 usan
índices de un solo campo, que Firestore crea automáticamente.

## 5. Verificación después de subir

- [ ] Login de admin y de un cajero.
- [ ] Clientes: el buscador encuentra clientes (con o sin acentos).
- [ ] Registrar una venta y verificar que el cliente sume 1 punto.
- [ ] Dashboard admin: "Total Clientes" muestra el total real.
- [ ] F12 → Consola: sin errores en rojo.
- [ ] F12 → Application → Service Workers: `sw.js` registrado con scope `/se7en/`.

## 6. Cambios de la v4.0 relevantes para soporte

### "Quota exceeded" en una sola computadora
Las versiones anteriores guardaban una copia diaria de todos los clientes en
`localStorage` sin borrar las de días anteriores. Tras unas semanas se llenaba el
límite del navegador (~5 MB) y aparecía `QuotaExceededError`. **No era la cuota de
Firebase.** Desde la v4.0:

- Al abrir la app se borran automáticamente los caches de días anteriores.
- Si el almacenamiento se llena igual, la app sigue funcionando sin cache.

### Consumo de lecturas de Firestore (plan Spark: 50.000/día)
- La lista de clientes se descarga **una vez por día y por navegador**; después solo
  se piden los clientes modificados (campo `updatedAt`).
- El buscador de clientes filtra en memoria (antes descargaba la colección completa
  en cada búsqueda).
- El total de clientes usa una consulta de agregación (1 lectura cada 1.000 clientes).
- El dashboard del admin solo pide las ventas nuevas desde la última consulta, con
  una recarga completa por hora.

Para revisar el consumo: Firebase Console → Firestore → Uso.

### Limitaciones conocidas
- Un cliente eliminado desde una computadora puede seguir apareciendo en el buscador
  de otras hasta el día siguiente (solo el admin elimina clientes).
- Los clientes creados antes de la v4.0 no tienen `updatedAt`; se incluyen igual en la
  descarga diaria y lo reciben en su próxima modificación.

## 7. Desarrollo local con emuladores (opcional)

Con `VITE_USE_FIREBASE_EMULATORS=true` en `.env.development.local`, `npm run dev`
se conecta a los emuladores locales de Auth (9099) y Firestore (8080) en lugar del
proyecto real. Esta opción no tiene efecto en el build de producción.
