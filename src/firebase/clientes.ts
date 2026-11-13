import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import { errorConCodigo } from '../utils/firebaseErrors';
import { Cliente, NuevoCliente } from './types';
import { sinUndefined, toDateOrUndefined } from './converters';
import { filtrarClientes } from './busqueda';
import {
  safeGetItem,
  safeGetJSON,
  safeRemoveItem,
  safeSetItem,
  purgeStaleDailyCaches,
} from '../utils/safeStorage';

// Estrategia de cache (para no agotar las 50K lecturas/día del plan Spark):
// - Una vez por día y por navegador se descarga la lista completa de clientes
//   y se guarda en localStorage (clave "clientes-todos-<fecha>").
// - Después, cada llamada a getClientes() solo pide a Firestore los clientes
//   modificados desde la última sincronización (campo `updatedAt`, que se
//   escribe con serverTimestamp() en cada alta/modificación). Si no hubo
//   cambios, cuesta 1 lectura.
// - La sincronización incremental se hace como máximo una vez por minuto,
//   salvo que esta misma pestaña haya modificado clientes.
// - Limitación conocida: un cliente eliminado desde otra computadora sigue
//   apareciendo en las demás hasta el día siguiente (solo admin elimina).

type ClienteCacheRow = Omit<Cliente, 'createdAt' | 'ultimaVisita'> & {
  createdAt: string;
  ultimaVisita?: string;
};

interface ClientesCache {
  key: string;            // clave del día al que pertenece
  list: Cliente[];
  lastSyncMillis: number; // mayor updatedAt (hora del servidor) visto
  lastCheckAt: number;    // última vez que se consultó el delta (hora local)
}

const CLIENTES_DELTA_INTERVAL_MS = 60 * 1000;
// Margen para tolerar escrituras con la misma marca de tiempo.
const CLIENTES_SYNC_MARGIN_MS = 1000;

const clientesCacheKey = () => `clientes-todos-${new Date().toDateString()}`;
const clientesSyncKey = () => `clientes-todos-time-${new Date().toDateString()}`;

let clientesMem: ClientesCache | null = null;
let clientesInFlight: Promise<Cliente[]> | null = null;

export const mapClienteDoc = (id: string, data: DocumentData): Cliente => ({
  ...(data as Cliente),
  id,
  visitas: data.visitas || 0,
  puntos: data.puntos || 0,
  puntosCanjeados: data.puntosCanjeados || 0,
  createdAt: toDateOrUndefined(data.createdAt) || new Date(),
  ultimaVisita: toDateOrUndefined(data.ultimaVisita),
  updatedAt: toDateOrUndefined(data.updatedAt),
});

const sortClientes = (list: Cliente[]) =>
  list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

const persistClientesCache = (cache: ClientesCache) => {
  purgeStaleDailyCaches();
  safeSetItem(cache.key, JSON.stringify(cache.list));
  safeSetItem(clientesSyncKey(), String(cache.lastSyncMillis));
};

const loadClientesCacheFromStorage = (): ClientesCache | null => {
  const key = clientesCacheKey();
  const rows = safeGetJSON<ClienteCacheRow[]>(key);
  const lastSyncMillis = Number(safeGetItem(clientesSyncKey()));
  if (!Array.isArray(rows) || !Number.isFinite(lastSyncMillis)) return null;
  return {
    key,
    list: rows.map((r) => mapClienteDoc(r.id as string, r)),
    lastSyncMillis,
    lastCheckAt: 0,
  };
};

const maxUpdatedAt = (list: Cliente[], initial = 0) =>
  list.reduce((max, c) => Math.max(max, c.updatedAt?.getTime() || 0), initial);

const fetchAllClientes = async (): Promise<ClientesCache> => {
  console.log('👥 Descargando lista completa de clientes (1 vez por día)');
  const snapshot = await getDocs(collection(db, 'clientes'));
  const list = sortClientes(snapshot.docs.map((d) => mapClienteDoc(d.id, d.data())));
  return {
    key: clientesCacheKey(),
    list,
    lastSyncMillis: maxUpdatedAt(list),
    lastCheckAt: Date.now(),
  };
};

const syncClientesDelta = async (cache: ClientesCache): Promise<ClientesCache> => {
  const desde = Timestamp.fromMillis(Math.max(0, cache.lastSyncMillis - CLIENTES_SYNC_MARGIN_MS));
  const snapshot = await getDocs(
    query(collection(db, 'clientes'), where('updatedAt', '>', desde))
  );
  if (snapshot.empty) return { ...cache, lastCheckAt: Date.now() };

  const byId = new Map(cache.list.map((c) => [c.id, c]));
  const cambios = snapshot.docs.map((d) => mapClienteDoc(d.id, d.data()));
  cambios.forEach((c) => byId.set(c.id, c));
  console.log(`👥 ${cambios.length} cliente(s) actualizados desde la última sincronización`);
  return {
    ...cache,
    list: sortClientes(Array.from(byId.values())),
    lastSyncMillis: maxUpdatedAt(cambios, cache.lastSyncMillis),
    lastCheckAt: Date.now(),
  };
};

/** Fuerza a que la próxima llamada a getClientes() consulte cambios. */
export const markClientesDirty = () => {
  if (clientesMem) clientesMem = { ...clientesMem, lastCheckAt: 0 };
};

const doGetClientes = async (): Promise<Cliente[]> => {
  const key = clientesCacheKey();
  let cache = clientesMem && clientesMem.key === key ? clientesMem : loadClientesCacheFromStorage();

  if (!cache) {
    cache = await fetchAllClientes();
    persistClientesCache(cache);
  } else if (Date.now() - cache.lastCheckAt > CLIENTES_DELTA_INTERVAL_MS) {
    const updated = await syncClientesDelta(cache);
    if (updated.list !== cache.list) persistClientesCache(updated);
    cache = updated;
  }

  clientesMem = cache;
  return cache.list;
};

/**
 * Lista completa de clientes ordenada por nombre (usa cache diario + sincronización
 * incremental). Devuelve una copia para que los componentes no muten el cache.
 */
export const getClientes = async (): Promise<Cliente[]> => {
  try {
    // Evita consultas duplicadas si varias pantallas piden la lista a la vez.
    if (!clientesInFlight) {
      clientesInFlight = doGetClientes().finally(() => {
        clientesInFlight = null;
      });
    }
    return [...(await clientesInFlight)];
  } catch (error) {
    console.error('Error getting clientes:', error);
    throw errorConCodigo('Error obteniendo clientes', error);
  }
};

// Clientes para la pantalla de listado.
// - Con búsqueda: filtra en memoria sobre la lista cacheada (antes descargaba
//   TODA la colección en cada búsqueda).
// - Sin búsqueda: los últimos `limitCount` creados.
// - `despuesDe`: para "cargar más", continúa después del cliente con esa fecha de alta.
export const getClientesPaginados = async (
  limitCount = 20,
  searchTerm?: string,
  despuesDe?: Date
): Promise<Cliente[]> => {
  try {
    if (searchTerm && searchTerm.trim() !== '') {
      return filtrarClientes(await getClientes(), searchTerm);
    }

    const base = query(collection(db, 'clientes'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(
      despuesDe
        ? query(base, startAfter(Timestamp.fromDate(despuesDe)), limit(limitCount))
        : query(base, limit(limitCount))
    );
    return snapshot.docs.map((d) => mapClienteDoc(d.id, d.data()));
  } catch (error) {
    console.error('Error getting clientes paginados:', error);
    throw errorConCodigo('Error obteniendo clientes paginados', error);
  }
};

// Total de clientes con consulta de agregación (cuesta 1 lectura cada 1000
// clientes, en lugar de 1 lectura por cliente). Cache de 6 horas.
export const getClientesCount = async (): Promise<number> => {
  try {
    const cacheKey = 'clientes-count';
    const cacheTimeKey = 'clientes-count-time';
    const cached = safeGetItem(cacheKey);
    const cacheTime = Number(safeGetItem(cacheTimeKey));

    if (cached && cacheTime && Date.now() - cacheTime < 6 * 60 * 60 * 1000) {
      return parseInt(cached, 10) || 0;
    }

    const snapshot = await getCountFromServer(collection(db, 'clientes'));
    const count = snapshot.data().count;

    safeSetItem(cacheKey, count.toString());
    safeSetItem(cacheTimeKey, Date.now().toString());
    return count;
  } catch (error) {
    console.error('Error counting clientes:', error);
    return 0;
  }
};

const invalidateClientesCount = () => {
  safeRemoveItem('clientes-count');
  safeRemoveItem('clientes-count-time');
};

export const createCliente = async (cliente: NuevoCliente) => {
  try {
    // Firestore rechaza campos undefined (p. ej. dni vacío): se omiten.
    const datos = sinUndefined(cliente);
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...datos,
      visitas: 0,
      puntos: 0,
      puntosCanjeados: 0,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: serverTimestamp(),
    });
    invalidateClientesCount();
    markClientesDirty();
    return docRef.id;
  } catch (error) {
    console.error('Error creating cliente:', error);
    throw errorConCodigo('Error creando cliente', error);
  }
};

/** Campos que se pueden editar desde la pantalla de clientes (las reglas lo exigen). */
export type DatosEditablesCliente = Pick<Cliente, 'nombre' | 'telefono'> &
  Partial<Pick<Cliente, 'email' | 'dni'>>;

export const updateCliente = async (id: string, datos: DatosEditablesCliente) => {
  try {
    const { nombre, telefono, email, dni } = datos;
    await updateDoc(doc(db, 'clientes', id), {
      ...sinUndefined({ nombre, telefono, email, dni }),
      updatedAt: serverTimestamp(),
    });
    markClientesDirty();
  } catch (error) {
    console.error('Error updating cliente:', error);
    throw errorConCodigo('Error actualizando cliente', error);
  }
};

export const deleteCliente = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'clientes', id));
    // La sincronización incremental no detecta borrados: quitarlo del cache local.
    if (clientesMem) {
      clientesMem = { ...clientesMem, list: clientesMem.list.filter((c) => c.id !== id) };
      persistClientesCache(clientesMem);
    }
    invalidateClientesCount();
  } catch (error) {
    console.error('Error deleting cliente:', error);
    throw errorConCodigo('Error eliminando cliente', error);
  }
};
