# Se7en Barbershop — Sistema de gestión (v4.0)

Aplicación web (PWA) para la gestión de la barbería: clientes, agenda, ventas,
puntos y premios, cajeros, adelantos y reportes.

- **Frontend:** React 18 + TypeScript + Vite 5 + Tailwind CSS. Rutas con React Router 7 (`HashRouter`).
- **Backend:** Firebase 13 (Authentication + Cloud Firestore), plan Spark (gratuito).
- **Hosting:** archivos estáticos en Hostinger (`https://cassdev.com.ar/se7en/`).

Guía de despliegue: [`README-DEPLOYMENT.md`](README-DEPLOYMENT.md).
Scripts de administración (roles): [`tools/README.md`](tools/README.md).

## Estructura

```
src/
  firebase/            Capa de datos (única parte que habla con Firestore)
    config.ts          Inicialización de Firebase (+ emuladores en desarrollo)
    auth.ts            Login, logout y normalización de roles
    types.ts           Tipos de dominio
    clientes.ts        Clientes + cache diario con sincronización incremental
    busqueda.ts        Búsqueda de clientes en memoria (pura)
    servicios.ts       Catálogo de servicios (cache 1 h)
    ventas.ts          Ventas: alta en batch (venta + puntos + resumen), consulta, baja
    resumenes.ts       Resúmenes diarios de ventas (lectura/inicialización)
    resumenesCalculo.ts  Cálculo de resúmenes (puro)
    dashboard.ts       Estadísticas del mes para Dashboard y Cajeros
    ventasCache.ts     Cache local de ventas del cajero
    turnos.ts          Agenda
    personal.ts        Perfiles de cajeros, plus manuales, adelantos
    puntos.ts          Premios y canjes (transacción)
    converters.ts      Conversión de fechas y utilidades puras
    firestore.ts       Re-exporta todos los módulos (punto de entrada para las pantallas)
  utils/
    safeStorage.ts     localStorage tolerante a "cuota excedida"
    firebaseErrors.ts  Mensajes de error claros para el usuario
    excelWriter.ts     Generación de .xlsx (write-excel-file)
    exportToExcel.ts   Reporte de ventas en Excel
  context/AuthContext.tsx  Sesión y perfil del usuario
  pages/, components/, hooks/   Interfaz
firestore.rules        Reglas de seguridad de Firestore
tests/unit/            Pruebas unitarias (Vitest)
tests/rules/           Pruebas de firestore.rules contra el emulador
tools/                 Scripts de administración con Admin SDK (no se despliegan)
```

## Comandos

```bash
npm ci                # instalar dependencias
npm run dev           # desarrollo (http://localhost:5173)
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm test              # pruebas unitarias
npm run test:rules    # pruebas de reglas (requiere Java 11+; descarga firebase-tools la primera vez)
npm run build         # build de producción en dist/
npm run preview       # sirve dist/ en http://localhost:4173/se7en/
```

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar las variables `VITE_FIREBASE_*`
(Firebase Console → Configuración del proyecto → Tus apps). Son valores públicos de la
app web, pero no se suben al repositorio. La seguridad la dan `firestore.rules`.

Para desarrollar sin tocar datos reales, agregar `VITE_USE_FIREBASE_EMULATORS=true` en
`.env.development.local` y ejecutar los emuladores:

```bash
npx firebase-tools@13 emulators:start --only auth,firestore --project demo-se7en
```

## Decisiones de diseño relevantes

- **Consumo de Firestore (plan gratuito, 50.000 lecturas/día):** la lista de clientes se
  descarga una vez por día y después solo se piden los modificados (`updatedAt`); la
  búsqueda es en memoria; el dashboard y el rendimiento de cajeros leen un resumen por
  día (`resumenes_ventas`) en lugar de cada venta.
- **Integridad:** una venta, su punto y su resumen se escriben en un único batch; el canje
  es una transacción. Las reglas verifican que los puntos solo cambien junto con una venta
  o canje real, que el precio coincida con el del servicio y que cada cajero registre solo
  a su nombre.
- **Roles:** `admin` y `cashier` (`cajero` se acepta como sinónimo histórico). Las reglas
  leen el rol del token (custom claim) y, si no está, del perfil `users/{uid}`.
