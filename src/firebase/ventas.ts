// Ventas: registro, consulta y eliminación.
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './config';
import { Venta } from './types';
import { toDateOrUndefined } from './converters';
import { markClientesDirty } from './clientes';
import { clearServiciosCache } from './servicios';
import { incrementoResumen, resumenRef } from './resumenes';
import { invalidarVentasCajero, marcarVentasCambiadas } from './ventasCache';
import { errorConCodigo } from '../utils/firebaseErrors';

export type NuevaVenta = Omit<Venta, 'id' | 'createdAt' | 'cajeroId' | 'cajeroEmail'>;

export const mapVentaDoc = (id: string, raw: DocumentData): Venta => ({
  id,
  clienteId: raw.clienteId,
  clienteNombre: raw.clienteNombre,
  servicioId: raw.servicioId,
  servicioNombre: raw.servicioNombre,
  precio: Number(raw.precio) || 0,
  metodoPago: raw.metodoPago === 'transferencia' ? 'transferencia' : 'efectivo',
  cajeroId: raw.cajeroId,
  cajeroNombre: raw.cajeroNombre,
  cajeroEmail: raw.cajeroEmail || '',
  fecha: toDateOrUndefined(raw.fecha) || new Date(NaN),
  createdAt: toDateOrUndefined(raw.createdAt) || new Date(NaN),
});

/**
 * Registra una venta. En un único batch (todo o nada):
 * - la venta (createdAt con hora del servidor),
 * - +1 visita y +1 punto al cliente (si existe) y su movimiento de puntos,
 * - la suma en el resumen del día.
 * Las reglas de Firestore validan que el precio coincida con el del servicio.
 */
export const createVenta = async (data: NuevaVenta, user: User): Promise<string> => {
  if (!user?.uid || !user.email) {
    throw new Error('Información del cajero no disponible');
  }

  const ventaRef = doc(collection(db, 'ventas'));
  const cajeroNombre =
    data.cajeroNombre && data.cajeroNombre !== 'Desconocido' ? data.cajeroNombre : user.email;
  const venta = { ...data, cajeroId: user.uid, cajeroNombre };

  try {
    const batch = writeBatch(db);
    batch.set(ventaRef, {
      ...venta,
      cajeroEmail: user.email,
      fecha: Timestamp.fromDate(data.fecha),
      createdAt: serverTimestamp(),
    });

    // Solo sumar puntos si el cliente todavía existe (puede venir de un cache viejo).
    const clienteRef = doc(db, 'clientes', data.clienteId);
    const clienteDoc = await getDoc(clienteRef);
    if (clienteDoc.exists()) {
      batch.update(clienteRef, {
        visitas: increment(1),
        puntos: increment(1), // +1 punto por corte
        ultimaVisita: serverTimestamp(),
        ultimaVentaId: ventaRef.id,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, 'movimientos_puntos')), {
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre,
        tipo: 'ganados',
        puntos: 1,
        motivo: `Corte: ${data.servicioNombre}`,
        ventaId: ventaRef.id,
        cajeroId: user.uid,
        cajeroNombre,
        fecha: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    batch.set(resumenRef(data.fecha), incrementoResumen(venta, ventaRef.id, 1), { merge: true });

    await batch.commit();
  } catch (error) {
    console.error('Error creating venta:', error);
    // Si fue rechazada (p. ej. el precio cambió), refrescar servicios y clientes.
    clearServiciosCache();
    markClientesDirty();
    throw errorConCodigo('Error creando venta', error);
  }

  invalidarVentasCajero(user.uid);
  marcarVentasCambiadas();
  markClientesDirty();
  return ventaRef.id;
};

/**
 * Ventas ordenadas por fecha (más recientes primero).
 * - Con rango de fechas: todas las del rango.
 * - Sin rango y sin búsqueda: las últimas `limitCount`.
 * - Sin rango y con búsqueda: todo el historial (filtrado en memoria).
 */
export const getVentas = async (
  cajeroId?: string,
  fechaInicio?: Date,
  fechaFin?: Date,
  limitCount = 20,
  searchTerm?: string
): Promise<Venta[]> => {
  try {
    let q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
    if (cajeroId) q = query(q, where('cajeroId', '==', cajeroId));
    if (fechaInicio) q = query(q, where('fecha', '>=', Timestamp.fromDate(fechaInicio)));
    if (fechaFin) q = query(q, where('fecha', '<=', Timestamp.fromDate(fechaFin)));

    const busqueda = searchTerm?.trim().toLowerCase() || '';
    if (!fechaInicio && !fechaFin && !busqueda) q = query(q, limit(limitCount));

    const snapshot = await getDocs(q);
    const ventas = snapshot.docs.map((d) => mapVentaDoc(d.id, d.data()));

    if (!busqueda) return ventas;
    return ventas.filter(
      (v) =>
        (v.clienteNombre || '').toLowerCase().includes(busqueda) ||
        (v.servicioNombre || '').toLowerCase().includes(busqueda) ||
        (v.cajeroNombre || '').toLowerCase().includes(busqueda)
    );
  } catch (error) {
    console.error('Error getting ventas:', error);
    throw errorConCodigo('Error obteniendo ventas', error);
  }
};

/**
 * Elimina una venta y la descuenta del resumen de su día (solo admin).
 * No revierte la visita ni el punto del cliente.
 */
export const deleteVenta = async (id: string): Promise<void> => {
  try {
    const ventaRef = doc(db, 'ventas', id);
    const snap = await getDoc(ventaRef);
    if (!snap.exists()) return;
    const venta = mapVentaDoc(snap.id, snap.data());

    if (isNaN(venta.fecha.getTime())) {
      await deleteDoc(ventaRef);
      return;
    }
    const batch = writeBatch(db);
    batch.delete(ventaRef);
    batch.set(resumenRef(venta.fecha), incrementoResumen(venta, id, -1), { merge: true });
    await batch.commit();
    invalidarVentasCajero(venta.cajeroId);
    marcarVentasCambiadas();
  } catch (error) {
    console.error('Error deleting venta:', error);
    throw errorConCodigo('Error eliminando venta', error);
  }
};
