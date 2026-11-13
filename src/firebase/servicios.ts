// Servicios: catálogo de cortes y precios.
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import { errorConCodigo } from '../utils/firebaseErrors';
import { Servicio } from './types';
import { toDateOrUndefined } from './converters';
import { safeGetItem, safeGetJSON, safeRemoveItem, safeSetItem } from '../utils/safeStorage';

const SERVICIOS_CACHE_KEY = 'servicios-activos';
const SERVICIOS_CACHE_TIME_KEY = 'servicios-activos-time';

/** Limpia el cache de servicios (al crear/editar/desactivar, o si una venta es rechazada). */
export const clearServiciosCache = () => {
  safeRemoveItem(SERVICIOS_CACHE_KEY);
  safeRemoveItem(SERVICIOS_CACHE_TIME_KEY);
};

export const createServicio = async (servicio: Omit<Servicio, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'servicios'), {
      ...servicio,
      createdAt: Timestamp.fromDate(new Date())
    });
    clearServiciosCache();
    return docRef.id;
  } catch (error) {
    console.error('Error creating servicio:', error);
    throw errorConCodigo('Error creando servicio', error);
  }
};

const mapServicioDoc = (id: string, data: DocumentData): Servicio => ({
  ...(data as Servicio),
  id,
  createdAt: toDateOrUndefined(data.createdAt) || new Date(),
});

const SERVICIOS_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Servicios activos para los formularios de Agenda y Ventas.
 * Cache de 1 hora: son pocos documentos y así los cambios del admin llegan
 * a las demás computadoras sin esperar un día.
 */
export const getServiciosActivos = async (): Promise<Servicio[]> => {
  try {
    const cached = safeGetJSON<Servicio[]>(SERVICIOS_CACHE_KEY);
    const cacheTime = Number(safeGetItem(SERVICIOS_CACHE_TIME_KEY));
    if (cached && cacheTime && Date.now() - cacheTime < SERVICIOS_CACHE_TTL_MS) {
      return cached;
    }

    const snapshot = await getDocs(
      query(collection(db, 'servicios'), where('activo', '==', true), orderBy('createdAt', 'desc'))
    );
    const servicios = snapshot.docs.map((d) => mapServicioDoc(d.id, d.data()));

    safeSetItem(SERVICIOS_CACHE_KEY, JSON.stringify(servicios));
    safeSetItem(SERVICIOS_CACHE_TIME_KEY, Date.now().toString());
    return servicios;
  } catch (error) {
    console.error('Error getting servicios activos:', error);
    throw errorConCodigo('Error obteniendo servicios activos', error);
  }
};

/** Todos los servicios, activos e inactivos (pantalla de administración). */
export const getServicios = async (): Promise<Servicio[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'servicios'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((d) => mapServicioDoc(d.id, d.data()));
  } catch (error) {
    console.error('Error getting servicios:', error);
    throw errorConCodigo('Error obteniendo servicios', error);
  }
};

export const updateServicio = async (id: string, servicio: Partial<Servicio>) => {
  try {
    await updateDoc(doc(db, 'servicios', id), servicio);
    clearServiciosCache();
  } catch (error) {
    console.error('Error updating servicio:', error);
    throw errorConCodigo('Error actualizando servicio', error);
  }
};

/** Desactiva el servicio (no se borra: lo referencian ventas y turnos). */
export const deleteServicio = async (id: string) => {
  try {
    await updateDoc(doc(db, 'servicios', id), { activo: false });
    clearServiciosCache();
  } catch (error) {
    console.error('Error deleting servicio:', error);
    throw errorConCodigo('Error eliminando servicio', error);
  }
};
