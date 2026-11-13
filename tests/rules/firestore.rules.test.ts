// Pruebas de firestore.rules contra el emulador (npm run test:rules).
// Reproducen las mismas escrituras que hace la app (batch de venta, transacción de canje).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  Firestore,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  setLogLevel,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { claveDia, incrementoResumen } from '../../src/firebase/resumenesCalculo';

let env: RulesTestEnvironment;
const HOY = new Date();

beforeAll(async () => {
  setLogLevel('silent'); // los rechazos esperados no ensucian la salida
  env = await initializeTestEnvironment({
    projectId: 'demo-se7en',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin'), { role: 'admin', name: 'Admin' });
    await setDoc(doc(db, 'users/caj1'), { role: 'cashier', name: 'Caj1' });
    await setDoc(doc(db, 'users/caj2'), { role: 'cajero', name: 'Caj2 (rol viejo)' });
    await setDoc(doc(db, 'clientes/c1'), { nombre: 'Juan', telefono: '1', visitas: 0, puntos: 12, puntosCanjeados: 0 });
    await setDoc(doc(db, 'clientes/sinPuntos'), { nombre: 'Sin campos de puntos', telefono: '2' });
    await setDoc(doc(db, 'servicios/s1'), { nombre: 'Corte', precio: 5000, activo: true });
    await setDoc(doc(db, 'premios/p1'), { nombre: 'Corte gratis', puntosRequeridos: 10, activo: true });
    await setDoc(doc(db, 'premios/inactivo'), { nombre: 'Viejo', puntosRequeridos: 1, activo: false });
    await setDoc(doc(db, 'ventas/v1'), { cajeroId: 'caj1', precio: 100 });
    await setDoc(doc(db, 'ventas/v2'), { cajeroId: 'caj2', precio: 200 });
    await setDoc(doc(db, 'adelantos/a1'), { cajeroId: 'caj1', monto: 50 });
  });
});

const as = (uid: string, claims?: Record<string, unknown>) => env.authenticatedContext(uid, claims).firestore();

/** Mismo batch que createVenta() en src/firebase/ventas.ts. */
const registrarVenta = (
  db: Firestore,
  cajeroId: string,
  opciones: { precio?: number; clienteId?: string; puntosExtra?: number; cajeroResumen?: string } = {}
) => {
  const clienteId = opciones.clienteId ?? 'c1';
  const precio = opciones.precio ?? 5000;
  const ventaRef = doc(collection(db, 'ventas'));
  const venta = {
    clienteId,
    clienteNombre: 'Juan',
    servicioId: 's1',
    servicioNombre: 'Corte',
    precio,
    metodoPago: 'efectivo' as const,
    fecha: HOY,
    cajeroId,
    cajeroNombre: 'Caj',
  };
  const batch = writeBatch(db);
  batch.set(ventaRef, { ...venta, cajeroEmail: 'x@x', fecha: Timestamp.fromDate(HOY), createdAt: serverTimestamp() });
  batch.update(doc(db, 'clientes', clienteId), {
    visitas: increment(1),
    puntos: increment(1 + (opciones.puntosExtra ?? 0)),
    ultimaVisita: serverTimestamp(),
    ultimaVentaId: ventaRef.id,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'movimientos_puntos')), { cajeroId, clienteId, puntos: 1, ventaId: ventaRef.id });
  batch.set(
    doc(db, 'resumenes_ventas', claveDia(HOY)),
    incrementoResumen({ ...venta, cajeroId: opciones.cajeroResumen ?? cajeroId }, ventaRef.id, 1),
    { merge: true }
  );
  return batch.commit();
};

/** Misma transacción que canjearPuntos() en src/firebase/puntos.ts. */
const canjear = (db: Firestore, cajeroId: string, premioId = 'p1', restaExtra = 0) =>
  runTransaction(db, async (tx) => {
    const clienteRef = doc(db, 'clientes/c1');
    const premio = (await tx.get(doc(db, 'premios', premioId))).data()!;
    await tx.get(clienteRef);
    const canjeRef = doc(collection(db, 'canjes_puntos'));
    tx.set(canjeRef, {
      clienteId: 'c1',
      premioId,
      puntosUtilizados: premio.puntosRequeridos,
      cajeroId,
      estado: 'canjeado',
    });
    tx.update(clienteRef, {
      puntos: increment(-(premio.puntosRequeridos + restaExtra)),
      puntosCanjeados: increment(premio.puntosRequeridos),
      ultimoCanjeId: canjeRef.id,
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, 'movimientos_puntos')), { cajeroId, clienteId: 'c1', puntos: -premio.puntosRequeridos });
  });

const leerCliente = async (id = 'c1') => {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'clientes', id))).data();
  });
  return data!;
};

describe('roles', () => {
  it('custom claim sin documento de perfil', async () => {
    await assertSucceeds(getDocs(query(collection(as('nuevo', { role: 'cashier' }), 'ventas'), where('cajeroId', '==', 'nuevo'))));
    await assertSucceeds(getDocs(collection(as('otroAdmin', { role: 'admin' }), 'ventas')));
  });
  it('sin claim ni perfil no hay acceso', async () => {
    await assertFails(getDocs(collection(as('desconocido'), 'clientes')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'clientes')));
  });
  it('rol viejo "cajero" funciona como cajero', async () => {
    await assertSucceeds(getDocs(query(collection(as('caj2'), 'ventas'), where('cajeroId', '==', 'caj2'))));
  });
  it('el cajero lee su perfil pero no lista usuarios ni se cambia el rol', async () => {
    await assertSucceeds(getDoc(doc(as('caj1'), 'users/caj1')));
    await assertFails(getDocs(query(collection(as('caj1'), 'users'), where('uid', '==', 'caj1'))));
    await assertFails(setDoc(doc(as('caj1'), 'users/caj1'), { role: 'admin' }));
  });
});

describe('ventas', () => {
  it('el cajero registra una venta completa (batch de la app)', async () => {
    await assertSucceeds(registrarVenta(as('caj1'), 'caj1'));
    const c = await leerCliente();
    if (c.puntos !== 13 || c.visitas !== 1) throw new Error(`cliente inesperado ${JSON.stringify(c)}`);
  });
  it('venta a un cliente sin campos de puntos (datos viejos)', async () => {
    await assertSucceeds(registrarVenta(as('caj1'), 'caj1', { clienteId: 'sinPuntos' }));
  });
  it('rechaza precio distinto al del servicio', async () => {
    await assertFails(registrarVenta(as('caj1'), 'caj1', { precio: 1 }));
  });
  it('rechaza venta a nombre de otro cajero', async () => {
    await assertFails(setDoc(doc(as('caj1'), 'ventas/x'), { cajeroId: 'caj2', precio: 5000, servicioId: 's1', createdAt: serverTimestamp() }));
  });
  it('rechaza createdAt con hora del cliente', async () => {
    await assertFails(
      setDoc(doc(as('caj1'), 'ventas/x'), {
        clienteId: 'c1', clienteNombre: 'J', servicioId: 's1', servicioNombre: 'Corte', precio: 5000,
        metodoPago: 'efectivo', fecha: Timestamp.now(), cajeroId: 'caj1', cajeroNombre: 'C', cajeroEmail: 'x',
        createdAt: Timestamp.fromMillis(Date.now() - 3600_000),
      })
    );
  });
  it('lecturas: admin todas, cajero solo las propias', async () => {
    await assertSucceeds(getDocs(collection(as('admin'), 'ventas')));
    await assertFails(getDocs(collection(as('caj1'), 'ventas')));
    await assertSucceeds(getDocs(query(collection(as('caj1'), 'ventas'), where('cajeroId', '==', 'caj1'))));
    await assertFails(getDoc(doc(as('caj1'), 'ventas/v2')));
  });
  it('solo el admin elimina ventas', async () => {
    const cajero = as('caj1');
    const admin = as('admin');
    await assertFails(writeBatch(cajero).delete(doc(cajero, 'ventas/v1')).commit());
    await assertSucceeds(writeBatch(admin).delete(doc(admin, 'ventas/v1')).commit());
  });
});

describe('clientes', () => {
  it('el cajero edita datos de contacto', async () => {
    await assertSucceeds(updateDoc(doc(as('caj1'), 'clientes/c1'), { nombre: 'Juan P', telefono: '9', updatedAt: serverTimestamp() }));
  });
  it('el cajero NO puede cambiar puntos directamente', async () => {
    await assertFails(updateDoc(doc(as('caj1'), 'clientes/c1'), { puntos: 999 }));
    await assertFails(updateDoc(doc(as('caj1'), 'clientes/c1'), { puntos: increment(1), visitas: increment(1) }));
  });
  it('el cajero NO puede reutilizar una venta existente para sumar puntos', async () => {
    await assertFails(
      updateDoc(doc(as('caj1'), 'clientes/c1'), { puntos: increment(1), visitas: increment(1), ultimaVentaId: 'v1' })
    );
  });
  it('el cajero NO puede sumar más de 1 punto por venta', async () => {
    await assertFails(registrarVenta(as('caj1'), 'caj1', { puntosExtra: 5 }));
  });
  it('alta por cajero solo con puntos en cero', async () => {
    await assertSucceeds(setDoc(doc(as('caj1'), 'clientes/nuevo'), { nombre: 'N', telefono: '1', visitas: 0, puntos: 0, puntosCanjeados: 0 }));
    await assertFails(setDoc(doc(as('caj1'), 'clientes/trampa'), { nombre: 'T', telefono: '1', visitas: 0, puntos: 50, puntosCanjeados: 0 }));
  });
  it('el admin puede corregir puntos', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'clientes/c1'), { puntos: 3 }));
  });
  it('conteo por agregación', async () => {
    await assertSucceeds(getCountFromServer(collection(as('caj1'), 'clientes')));
  });
});

describe('canjes', () => {
  it('canje válido (transacción de la app)', async () => {
    await assertSucceeds(canjear(as('caj1'), 'caj1'));
    const c = await leerCliente();
    if (c.puntos !== 2 || c.puntosCanjeados !== 10) throw new Error(`cliente inesperado ${JSON.stringify(c)}`);
  });
  it('rechaza restar puntos de más', async () => {
    await assertFails(canjear(as('caj1'), 'caj1', 'p1', 1));
  });
  it('rechaza premio inactivo', async () => {
    await assertFails(canjear(as('caj1'), 'caj1', 'inactivo'));
  });
  it('rechaza canje a nombre de otro cajero', async () => {
    await assertFails(canjear(as('caj1'), 'caj2'));
  });
});

describe('resúmenes diarios', () => {
  it('el cajero no puede leer resúmenes; el admin sí', async () => {
    await assertFails(getDocs(collection(as('caj1'), 'resumenes_ventas')));
    await assertSucceeds(getDocs(collection(as('admin'), 'resumenes_ventas')));
  });
  it('dos ventas seguidas suman en el mismo día', async () => {
    await assertSucceeds(registrarVenta(as('caj1'), 'caj1'));
    await assertSucceeds(registrarVenta(as('caj2'), 'caj2'));
    let r: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      r = (await getDoc(doc(ctx.firestore(), 'resumenes_ventas', claveDia(HOY)))).data();
    });
    if (r?.total !== 10000 || r?.cantidad !== 2) throw new Error(`resumen inesperado ${JSON.stringify(r)}`);
  });
  it('el cajero no puede escribir el resumen sin una venta nueva', async () => {
    await assertFails(setDoc(doc(as('caj1'), 'resumenes_ventas', claveDia(HOY)), { total: 1, cantidad: 1, ultimaVentaId: 'v1' }));
  });
  it('el cajero no puede sumar su venta en la entrada de otro cajero', async () => {
    await assertFails(registrarVenta(as('caj1'), 'caj1', { cajeroResumen: 'caj2' }));
  });
});

describe('adelantos', () => {
  it('cajero: lee y crea solo los propios', async () => {
    await assertSucceeds(getDocs(query(collection(as('caj1'), 'adelantos'), where('cajeroId', '==', 'caj1'))));
    await assertFails(getDocs(collection(as('caj1'), 'adelantos')));
    await assertSucceeds(setDoc(doc(as('caj1'), 'adelantos/a2'), { cajeroId: 'caj1', monto: 1 }));
    await assertFails(setDoc(doc(as('caj1'), 'adelantos/a3'), { cajeroId: 'caj2', monto: 1 }));
  });
  it('admin crea adelantos para cualquier cajero', async () => {
    await assertSucceeds(setDoc(doc(as('admin'), 'adelantos/a4'), { cajeroId: 'caj1', monto: 1 }));
  });
});

describe('config', () => {
  it('solo admin', async () => {
    await assertFails(getDoc(doc(as('caj1'), 'config/resumenes')));
    await assertSucceeds(setDoc(doc(as('admin'), 'config/resumenes'), { desde: '2026-11-01' }));
  });
});
