# Guía de despliegue — Se7en Barbershop (v4.0)

Destino: **https://cassdev.com.ar/se7en/** (Hostinger, Apache).

> ⚠️ **Importante — una sola versión en uso.** Las reglas de Firestore de la v4.0
> rechazan las ventas y canjes hechos con la versión 3.0 (registraban la hora y los
> puntos de otra forma). Publicá las reglas nuevas **solo cuando todas las
> computadoras usen `cassdev.com.ar/se7en`**. Si alguien sigue entrando a la URL vieja,
> va a ver errores al registrar ventas.

## 0. Antes de empezar (una sola vez)

- **Contraseñas expuestas:** las contraseñas de ejemplo de versiones anteriores
  (`admin123`, `cajero123`, `leandro rb`) quedaron en el historial público del repositorio.
  Si alguna es real, cambiala en Firebase Console → Authentication → (usuario) → Restablecer contraseña.
- **Respaldo de las reglas actuales:** Firebase Console → Firestore → Reglas → copiá el
  texto actual a un archivo, para poder volver atrás.

## 1. Build

Requisitos: Node.js 20 o superior y `.env.local` con las variables `VITE_FIREBASE_*`
(ver `.env.local.example`).

```bash
npm ci
npm run typecheck && npm run lint && npm test
npm run build
```

## 2. Probar con los datos reales antes de subir

```bash
npm run preview
```

Abrí `http://localhost:4173/se7en/` (`localhost` ya está autorizado en Firebase).
**Ojo: escribe en la base real.** Usá un cliente de prueba y verificá:

- [ ] Login de admin y de un cajero.
- [ ] Buscar un cliente (con y sin acentos).
- [ ] Registrar una venta al cliente de prueba y ver que sume 1 punto.
- [ ] Dashboard del admin: ventas del mes y total de clientes correctos.
      La primera vez que el admin abre el Dashboard se crean los resúmenes del mes
      (`resumenes_ventas` y `config/resumenes`); es normal que tarde un poco más.
- [ ] Reportes → Exportar Excel.

En esta prueba todavía rigen las **reglas viejas**, que son más permisivas: sirve para
probar la app, no las reglas (ver paso 4).

## 3. Subir a Hostinger

1. Administrador de archivos → `public_html/se7en/` (crearla si no existe).
2. Borrar el contenido anterior de esa carpeta.
3. Subir **todo el contenido** de `dist/`, incluido el archivo oculto `.htaccess`.
4. Verificar que HTTPS esté activo en `cassdev.com.ar`.
5. Firebase Console → Authentication → Configuración → **Dominios autorizados** →
   agregar `cassdev.com.ar`. Si la API key está restringida por referente en Google Cloud
   Console → APIs y servicios → Credenciales, agregar `https://cassdev.com.ar/*`.

## 4. Publicar las reglas de Firestore

Cuando **todas** las computadoras ya usen la URL nueva:

1. Firebase Console → Firestore → **Reglas** → pegar el contenido de `firestore.rules`.
2. **Antes de publicar**, abrí el **Rules Playground** (botón en esa misma pantalla) y simulá:

   | Simulación | Usuario autenticado (UID) | Resultado esperado |
   |---|---|---|
   | `get` en `/ventas/<id de una venta del cajero>` | UID del cajero | Permitido |
   | `get` en `/ventas/<id de una venta de otro cajero>` | UID del cajero | Denegado |
   | `get` en `/resumenes_ventas/2026-11-13` | UID del cajero | Denegado |
   | `get` en `/ventas/<cualquier id>` | UID del admin | Permitido |
   | `update` en `/clientes/<id>` con `{"puntos": 999}` | UID del cajero | Denegado |

   (El UID de cada usuario está en Authentication → Usuarios.)
3. **Publicar.** Si algo sale mal, pegá las reglas que guardaste en el paso 0 y publicá de nuevo.
4. Repetir en la app real: registrar una venta como cajero y abrir el Dashboard como admin.

## 5. (Opcional, recomendado) Roles en el token

Reduce una lectura por consulta. Instrucciones en [`tools/README.md`](tools/README.md).

## 6. Verificación final

- [ ] F12 → Consola: sin errores en rojo.
- [ ] F12 → Application → Service Workers: `sw.js` activo con scope `/se7en/`.
- [ ] Firebase Console → Firestore → Uso: lecturas por debajo de 50.000/día.

## Soporte

### "Quota exceeded" en una computadora
Era el almacenamiento del navegador (`localStorage`, ~5 MB), no Firebase. Desde la v4.0
la app libera el espacio sola al abrirse y, si aun así falta, sigue funcionando sin cache.

### "La venta fue rechazada: el precio del servicio cambió"
El admin cambió el precio y el formulario tenía el anterior. La app recarga los precios
automáticamente; basta con volver a intentar.

### El dashboard muestra montos distintos a Reportes
Reportes calcula a partir de cada venta; el dashboard usa los resúmenes diarios. Si una
venta se registró justo mientras se inicializaban los resúmenes, puede faltar en el
resumen de ese día. Para recalcular: borrar el documento `config/resumenes` en
Firestore y abrir el Dashboard como admin (se regenera el mes en curso).

### Limitaciones conocidas
- Un cliente eliminado desde una computadora puede seguir apareciendo en el buscador de
  las otras hasta el día siguiente (solo el admin elimina clientes).
- Eliminar una venta la descuenta del resumen, pero no le quita la visita ni el punto
  al cliente (igual que en versiones anteriores).
- El cajero podría alterar los totales por servicio del resumen del día (no los totales
  generales ni los de otros cajeros, que las reglas validan). Reportes no depende de
  los resúmenes.
