import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getDoc,
  startAfter,
  getCountFromServer,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
  DocumentData
} from 'firebase/firestore';
import { db } from './config';
import { safeGetItem, safeGetJSON, safeSetItem, safeRemoveItem, purgeStaleDailyCaches, purgeAppCaches } from '../utils/safeStorage';
import { User } from 'firebase/auth';
import { UserProfile } from './auth';

export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  email?: string;
  dni?: string;
  visitas: number;
  ultimaVisita?: Date;
  puntos: number; // Puntos acumulados
  puntosCanjeados: number; // Puntos ya utilizados
  createdAt: Date;
  updatedAt?: Date; // Lo escribe el servidor; se usa para la sincronización incremental
}

/** Datos para crear un cliente: puntos y fechas los asigna el sistema. */
export type NuevoCliente = Omit<Cliente, 'id' | 'createdAt' | 'updatedAt' | 'puntos' | 'puntosCanjeados' | 'visitas'> & {
  visitas?: number;
};

export interface Servicio {
  id?: string;
  nombre: string;
  precio: number;
  duracion: number; // en minutos
  descripcion?: string;
  activo: boolean;
  createdAt: Date;
}

export interface Venta {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  servicioId: string;
  servicioNombre: string;
  precio: number;
  metodoPago: 'efectivo' | 'transferencia';
  cajeroId: string;
  cajeroNombre: string;
  cajeroEmail: string;
  fecha: any;
  createdAt: any;
}

export interface Turno {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  servicioId: string;
  servicioNombre: string;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  hora: string;
  estado: 'pendiente' | 'completado' | 'cancelado';
  createdAt: Date;
}

export interface PlusManual {
  id?: string;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date; // Solo fecha (sin hora)
  monto: number;
  motivo?: string;
  adminId: string;
  adminNombre: string;
  createdAt: Date;
}

export interface Adelanto {
  id?: string;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  monto: number;
  concepto: string; // Por qué se da el adelanto (materiales, gastos, etc.)
  estado: 'pendiente' | 'descontado' | 'pagado'; // Estado del adelanto
  adminId: string;
  adminNombre: string;
  fechaDescuento?: Date; // Cuándo se descontó del pago
  observaciones?: string;
  createdAt: Date;
}

// Nuevas interfaces para el sistema de puntos
export interface Premio {
  id?: string;
  nombre: string;
  descripcion: string;
  puntosRequeridos: number;
  activo: boolean;
  tipo: 'descuento' | 'servicio_gratis' | 'producto'; // Tipo de premio
  valor?: number; // Para descuentos (ej: 50 para 50% off)
  servicioId?: string; // Para servicios gratis específicos
  createdAt: Date;
}

export interface CanjeoPuntos {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  premioId: string;
  premioNombre: string;
  puntosUtilizados: number;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  estado: 'canjeado' | 'utilizado'; // canjeado = disponible para usar, utilizado = ya usado
  ventaId?: string; // Si se aplicó en una venta específica
  createdAt: Date;
}

export interface MovimientoPuntos {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  tipo: 'ganados' | 'canjeados' | 'ajuste'; // Tipo de movimiento
  puntos: number; // Positivo para ganados, negativo para canjeados
  motivo: string; // Descripción del movimiento
  ventaId?: string; // Si fue por una venta
  canjeId?: string; // Si fue por un canje
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  createdAt: Date;
}

// ============ CLIENTES ============
//
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

const toDateOrUndefined = (value: unknown): Date | undefined => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

const mapClienteDoc = (id: string, data: DocumentData): Cliente => ({
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
const markClientesDirty = () => {
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
    throw new Error('Error obteniendo clientes');
  }
};

const normalizar = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Filtra clientes en memoria por nombre, teléfono, email o DNI. */
export const filtrarClientes = (clientes: Cliente[], searchTerm: string): Cliente[] => {
  const term = normalizar(searchTerm.trim());
  if (!term) return clientes;
  return clientes
    .filter(
      (c) =>
        normalizar(c.nombre || '').includes(term) ||
        (c.telefono || '').includes(searchTerm.trim()) ||
        normalizar(c.email || '').includes(term) ||
        (c.dni || '').includes(searchTerm.trim())
    )
    .sort((a, b) => {
      const aStarts = normalizar(a.nombre || '').startsWith(term);
      const bStarts = normalizar(b.nombre || '').startsWith(term);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
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
    throw new Error('Error obteniendo clientes paginados');
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
    const datos = Object.fromEntries(
      Object.entries(cliente).filter(([, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...datos,
      visitas: cliente.visitas || 0,
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
    throw new Error('Error creando cliente');
  }
};

export const updateCliente = async (id: string, cliente: Partial<Cliente>) => {
  try {
    // No se permite sobrescribir id ni fechas de sistema; Firestore rechaza undefined.
    const camposSistema = ['id', 'createdAt', 'updatedAt'];
    const updateData: DocumentData = Object.fromEntries(
      Object.entries(cliente).filter(([k, v]) => v !== undefined && !camposSistema.includes(k))
    );
    if (cliente.ultimaVisita instanceof Date) {
      updateData.ultimaVisita = Timestamp.fromDate(cliente.ultimaVisita);
    }
    updateData.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'clientes', id), updateData);
    markClientesDirty();
  } catch (error) {
    console.error('Error updating cliente:', error);
    throw new Error('Error actualizando cliente');
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
    throw new Error('Error eliminando cliente');
  }
};

// Servicios
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
    throw new Error('Error creando servicio');
  }
};

// Función para obtener solo servicios activos CON CACHE (para formularios de Agenda y Ventas)
export const getServiciosActivos = async (): Promise<Servicio[]> => {
  try {
    const cacheKey = 'servicios-activos';
    const cacheTimeKey = 'servicios-activos-time';
    const cached = safeGetJSON<Servicio[]>(cacheKey);
    const cacheTime = safeGetItem(cacheTimeKey);
    
    // Cache válido por 1 hora: son pocos documentos y así los cambios del
    // admin llegan a las demás computadoras sin esperar un día.
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 60 * 60 * 1000) {
      return cached;
    }
    
    // Cache expirado o no existe - consultar Firebase
    console.log('🔧 Consultando servicios activos desde Firebase');
    const querySnapshot = await getDocs(
      query(collection(db, 'servicios'), where('activo', '==', true), orderBy('createdAt', 'desc'))
    );
    
    const servicios = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Servicio;
    });
    
    // Guardar en cache
    safeSetItem(cacheKey, JSON.stringify(servicios));
    safeSetItem(cacheTimeKey, Date.now().toString());
    
    return servicios;
  } catch (error) {
    console.error('Error getting servicios activos:', error);
    throw new Error('Error obteniendo servicios activos');
  }
};

// Función para obtener todos los servicios (para administración)
export const getServicios = async (): Promise<Servicio[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'servicios'), orderBy('createdAt', 'desc'))
    );
    
    // Eliminar duplicados basados en el ID
    const serviciosMap = new Map();
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const servicio = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Servicio;
      
      // Solo agregar si no existe o si es más reciente
      if (!serviciosMap.has(doc.id) || 
          serviciosMap.get(doc.id).createdAt < servicio.createdAt) {
        serviciosMap.set(doc.id, servicio);
      }
    });
    
    return Array.from(serviciosMap.values());
  } catch (error) {
    console.error('Error getting servicios:', error);
    throw new Error('Error obteniendo servicios');
  }
};

export const updateServicio = async (id: string, servicio: Partial<Servicio>) => {
  try {
    await updateDoc(doc(db, 'servicios', id), servicio);
    clearServiciosCache();
  } catch (error) {
    console.error('Error updating servicio:', error);
    throw new Error('Error actualizando servicio');
  }
};

// Ventas
// La venta, la suma de visita/punto del cliente y el movimiento de puntos se
// escriben en un único batch: o se guardan todos o ninguno.
export const createVenta = async (data: Omit<Venta, 'id' | 'createdAt' | 'cajeroId' | 'cajeroEmail'>, user: User) => {
  try {
    if (!user?.uid || !user.email) {
      throw new Error("Información del cajero no disponible");
    }

    const ventaRef = doc(collection(db, 'ventas'));
    const cajeroNombre = data.cajeroNombre && data.cajeroNombre !== 'Desconocido' ? data.cajeroNombre : user.email || 'N/A';
    const ahora = Timestamp.fromDate(new Date());

    const batch = writeBatch(db);
    batch.set(ventaRef, {
      ...data,
      cajeroId: user.uid,
      cajeroNombre,
      cajeroEmail: user.email,
      fecha: Timestamp.fromDate(data.fecha),
      createdAt: ahora,
    });

    // Solo sumar puntos si el cliente todavía existe (puede venir de un cache viejo).
    const clienteRef = doc(db, 'clientes', data.clienteId);
    const clienteDoc = await getDoc(clienteRef);
    if (clienteDoc.exists()) {
      batch.update(clienteRef, {
        visitas: increment(1),
        puntos: increment(1), // +1 punto por corte
        ultimaVisita: ahora,
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
        fecha: ahora,
        createdAt: ahora,
      });
    }

    await batch.commit();

    invalidateDashboardCache(user.uid);
    markClientesDirty();
    return ventaRef.id;
  } catch (error) {
    console.error('Error creating venta:', error);
    throw new Error('Error creando venta');
  }
};

export const getVentas = async (cajeroId?: string, fechaInicio?: Date, fechaFin?: Date, limitCount = 20, searchTerm?: string): Promise<Venta[]> => {
  try {
    let q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'));
    
    // Si hay filtros específicos (fechas, cajero, búsqueda), cargar todos los datos
    const hasFilters = cajeroId || fechaInicio || fechaFin || (searchTerm && searchTerm.trim() !== '');
    
    if (cajeroId) {
      q = query(q, where('cajeroId', '==', cajeroId));
    }
    
    // Filtrar por fechas si se proporcionan
    if (fechaInicio) {
      q = query(q, where('fecha', '>=', Timestamp.fromDate(fechaInicio)));
    }
    if (fechaFin) {
      q = query(q, where('fecha', '<=', Timestamp.fromDate(fechaFin)));
    }
    
    // Solo aplicar límite si no hay filtros específicos
    if (!hasFilters) {
      q = query(q, limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    let ventas = querySnapshot.docs.map((d) => mapVentaDoc(d.id, d.data()));

    // Filtrar por término de búsqueda si existe
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      ventas = ventas.filter(venta => 
        venta.clienteNombre.toLowerCase().includes(searchLower) ||
        venta.servicioNombre.toLowerCase().includes(searchLower) ||
        venta.cajeroNombre.toLowerCase().includes(searchLower)
      );
    }
    
    return ventas;
  } catch (error) {
    console.error('Error getting ventas:', error);
    throw new Error('Error obteniendo ventas');
  }
};

export const deleteVenta = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'ventas', id));
    // Forzar recarga completa del dashboard admin (el delta no detecta borrados).
    safeRemoveItem(dashboardKey());
  } catch (error) {
    console.error('Error deleting venta:', error);
    throw new Error('Error eliminando venta');
  }
};

// Turnos
export const createTurno = async (turno: Omit<Turno, 'id' | 'createdAt'>) => {
  try {
    // Validar que todos los campos requeridos estén presentes
    if (!turno.cajeroId || !turno.cajeroNombre) {
      console.error('❌ Datos del cajero faltantes en turno:', { 
        cajeroId: turno.cajeroId, 
        cajeroNombre: turno.cajeroNombre 
      });
      throw new Error('Información del cajero no disponible');
    }

    console.log('✅ Creando turno con datos:', turno);

    const docRef = await addDoc(collection(db, 'turnos'), {
      ...turno,
      fecha: Timestamp.fromDate(turno.fecha),
      createdAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating turno:', error);
    throw new Error('Error creando turno');
  }
};

export const getTurnos = async (fecha?: Date, cajeroId?: string): Promise<Turno[]> => {
  try {
    let q = query(collection(db, 'turnos'), orderBy('fecha', 'asc'), orderBy('hora', 'asc'));

    if (fecha) {
      const start = new Date(fecha);
      start.setHours(0, 0, 0, 0);
      const end = new Date(fecha);
      end.setHours(23, 59, 59, 999);
      q = query(q, where('fecha', '>=', start), where('fecha', '<=', end));
    }

    if (cajeroId) {
      q = query(q, where('cajeroId', '==', cajeroId));
    }

    const querySnapshot = await getDocs(q);
    let turnos = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: data.fecha?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as Turno;
    });
    
    // Filtrar por fecha si se proporciona
    if (fecha) {
      const fechaStr = fecha.toDateString();
      turnos = turnos.filter(turno => 
        turno.fecha.toDateString() === fechaStr
      );
    }
    
    return turnos;
  } catch (error) {
    console.error('Error getting turnos:', error);
    throw new Error('Error obteniendo turnos');
  }
};

export const updateTurno = async (id: string, turno: Partial<Turno>) => {
  try {
    const updateData = { ...turno };
    if (updateData.fecha) {
      updateData.fecha = Timestamp.fromDate(updateData.fecha as Date) as any;
    }
    await updateDoc(doc(db, 'turnos', id), updateData);
  } catch (error) {
    console.error('Error updating turno:', error);
    throw new Error('Error actualizando turno');
  }
};

export const deleteTurno = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'turnos', id));
  } catch (error) {
    console.error('Error deleting turno:', error);
    throw new Error('Error eliminando turno');
  }
};

// Servicios
export const deleteServicio = async (id: string) => {
  try {
    // En lugar de eliminar completamente, marcar como inactivo
    // Esto mantiene la integridad referencial con turnos y ventas existentes
    await updateDoc(doc(db, 'servicios', id), { activo: false });
    clearServiciosCache();
  } catch (error) {
    console.error('Error deleting servicio:', error);
    throw new Error('Error eliminando servicio');
  }
};

// Cajeros (User Profiles)
export const createCajero = async (cajero: Omit<UserProfile, 'uid' | 'createdAt'>) => {
  try {
    // Firebase Auth user creation should happen separately or be handled here if it's integrated
    const docRef = await addDoc(collection(db, 'users'), {
      ...cajero,
      createdAt: Timestamp.fromDate(new Date()),
      role: 'cashier' // Rol que usa la app para cajeros (ver normalizeProfile)
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating cashier profile:', error);
    throw new Error('Error creando perfil de cajero');
  }
};

export const updateCajero = async (uid: string, cajero: Partial<UserProfile>) => {
  try {
    await updateDoc(doc(db, 'users', uid), cajero);
  } catch (error) {
    console.error('Error updating cashier profile:', error);
    throw new Error('Error actualizando perfil de cajero');
  }
};

export const deleteCajeroProfile = async (uid: string) => {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.error('Error deleting cashier profile:', error);
    throw new Error('Error eliminando perfil de cajero');
  }
};

// Plus Manuales
export const createPlusManual = async (plus: Omit<PlusManual, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'plus_manuales'), {
      ...plus,
      fecha: Timestamp.fromDate(plus.fecha),
      createdAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating plus manual:', error);
    throw new Error('Error creando plus manual');
  }
};

export const getPlusManuales = async (cajeroId?: string, fecha?: Date, fechaFin?: Date): Promise<PlusManual[]> => {
  try {
    const collectionRef = collection(db, 'plus_manuales');
    let q;

    // Simplificar la consulta para evitar errores de índices
    if (cajeroId && fecha && fechaFin) {
      // Consulta específica por cajero y período
      const inicioDelPeriodo = new Date(fecha);
      inicioDelPeriodo.setHours(0, 0, 0, 0);
      const finDelPeriodo = new Date(fechaFin);
      finDelPeriodo.setHours(23, 59, 59, 999);

      q = query(
        collectionRef, 
        where('cajeroId', '==', cajeroId),
        where('fecha', '>=', Timestamp.fromDate(inicioDelPeriodo)),
        where('fecha', '<=', Timestamp.fromDate(finDelPeriodo))
      );
    } else if (cajeroId && fecha) {
      // Consulta específica por cajero y fecha
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);

      q = query(
        collectionRef, 
        where('cajeroId', '==', cajeroId),
        where('fecha', '>=', Timestamp.fromDate(inicioDelDia)),
        where('fecha', '<=', Timestamp.fromDate(finDelDia))
      );
    } else if (cajeroId) {
      // Solo por cajero
      q = query(collectionRef, where('cajeroId', '==', cajeroId), orderBy('createdAt', 'desc'));
    } else if (fecha && fechaFin) {
      // Solo por período - usar orderBy en fecha en lugar de createdAt
      const inicioDelPeriodo = new Date(fecha);
      inicioDelPeriodo.setHours(0, 0, 0, 0);
      const finDelPeriodo = new Date(fechaFin);
      finDelPeriodo.setHours(23, 59, 59, 999);

      q = query(
        collectionRef,
        where('fecha', '>=', Timestamp.fromDate(inicioDelPeriodo)),
        where('fecha', '<=', Timestamp.fromDate(finDelPeriodo)),
        orderBy('fecha', 'desc')
      );
    } else if (fecha) {
      // Solo por fecha - usar orderBy en fecha en lugar de createdAt
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);

      q = query(
        collectionRef,
        where('fecha', '>=', Timestamp.fromDate(inicioDelDia)),
        where('fecha', '<=', Timestamp.fromDate(finDelDia)),
        orderBy('fecha', 'desc')
      );
    } else {
      // Consulta general
      q = query(collectionRef, orderBy('createdAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: data.fecha?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as PlusManual;
    });
      } catch (error) {
      console.error('Error getting plus manuales:', error);
      // Si hay error de índices, hacer consulta más simple y filtrar en cliente
      try {
        const fallbackCollectionRef = collection(db, 'plus_manuales');
        const simpleQuery = query(fallbackCollectionRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(simpleQuery);
        let results = querySnapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            cajeroId: data.cajeroId,
            cajeroNombre: data.cajeroNombre,
            fecha: data.fecha?.toDate() || new Date(),
            monto: data.monto,
            motivo: data.motivo,
            adminId: data.adminId,
            adminNombre: data.adminNombre,
            createdAt: data.createdAt?.toDate() || new Date()
          } as PlusManual;
        });

        // Filtrar en cliente si es necesario
        if (cajeroId) {
          results = results.filter(p => p.cajeroId === cajeroId);
        }
        if (fecha && fechaFin) {
          const fechaStr = fecha.toDateString();
          const fechaFinStr = fechaFin.toDateString();
          results = results.filter(p => {
            const plusFecha = p.fecha.toDateString();
            return plusFecha >= fechaStr && plusFecha <= fechaFinStr;
          });
        } else if (fecha) {
          const fechaStr = fecha.toDateString();
          results = results.filter(p => p.fecha.toDateString() === fechaStr);
        }

        return results;
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError);
        return []; // Retornar array vacío en caso de error total
      }
    }
};

export const deletePlusManual = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'plus_manuales', id));
  } catch (error) {
    console.error('Error deleting plus manual:', error);
    throw new Error('Error eliminando plus manual');
  }
};

// Adelantos
export const createAdelanto = async (adelanto: Omit<Adelanto, 'id' | 'createdAt'>) => {
  try {
    // Limpiar campos undefined antes de enviar a Firestore
    const adelantoData: any = {
      cajeroId: adelanto.cajeroId,
      cajeroNombre: adelanto.cajeroNombre,
      fecha: Timestamp.fromDate(adelanto.fecha),
      monto: adelanto.monto,
      concepto: adelanto.concepto,
      estado: adelanto.estado,
      adminId: adelanto.adminId,
      adminNombre: adelanto.adminNombre,
      fechaDescuento: adelanto.fechaDescuento ? Timestamp.fromDate(adelanto.fechaDescuento) : null,
      createdAt: Timestamp.fromDate(new Date())
    };
    
    // Solo añadir observaciones si no es undefined/null/empty
    if (adelanto.observaciones && adelanto.observaciones.trim() !== '') {
      adelantoData.observaciones = adelanto.observaciones;
    }
    
    const docRef = await addDoc(collection(db, 'adelantos'), adelantoData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating adelanto:', error);
    throw new Error('Error creando adelanto');
  }
};

export const getAdelantos = async (cajeroId?: string, fecha?: Date, estado?: string, fechaFin?: Date, limitCount?: number): Promise<Adelanto[]> => {
  try {
    const collectionRef = collection(db, 'adelantos');
    let q;

    if (cajeroId && fecha && fechaFin) {
      // Consulta específica por cajero y período
      const inicioDelPeriodo = new Date(fecha);
      inicioDelPeriodo.setHours(0, 0, 0, 0);
      const finDelPeriodo = new Date(fechaFin);
      finDelPeriodo.setHours(23, 59, 59, 999);

      q = query(
        collectionRef, 
        where('cajeroId', '==', cajeroId),
        where('fecha', '>=', Timestamp.fromDate(inicioDelPeriodo)),
        where('fecha', '<=', Timestamp.fromDate(finDelPeriodo)),
        orderBy('fecha', 'desc')
      );
    } else if (cajeroId && fecha) {
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);

      q = query(
        collectionRef, 
        where('cajeroId', '==', cajeroId),
        where('fecha', '>=', Timestamp.fromDate(inicioDelDia)),
        where('fecha', '<=', Timestamp.fromDate(finDelDia)),
        orderBy('fecha', 'desc')
      );
    } else if (cajeroId && estado) {
      q = query(
        collectionRef, 
        where('cajeroId', '==', cajeroId),
        where('estado', '==', estado),
        orderBy('createdAt', 'desc')
      );
    } else if (cajeroId) {
      // Si hay límite y no hay filtros de fecha, aplicar límite
      if (limitCount && !fecha && !fechaFin) {
        q = query(collectionRef, where('cajeroId', '==', cajeroId), orderBy('createdAt', 'desc'), limit(limitCount));
      } else {
        q = query(collectionRef, where('cajeroId', '==', cajeroId), orderBy('createdAt', 'desc'));
      }
    } else if (fecha && fechaFin) {
      // Solo por período
      const inicioDelPeriodo = new Date(fecha);
      inicioDelPeriodo.setHours(0, 0, 0, 0);
      const finDelPeriodo = new Date(fechaFin);
      finDelPeriodo.setHours(23, 59, 59, 999);

      q = query(
        collectionRef,
        where('fecha', '>=', Timestamp.fromDate(inicioDelPeriodo)),
        where('fecha', '<=', Timestamp.fromDate(finDelPeriodo)),
        orderBy('fecha', 'desc')
      );
    } else if (fecha) {
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);

      q = query(
        collectionRef,
        where('fecha', '>=', Timestamp.fromDate(inicioDelDia)),
        where('fecha', '<=', Timestamp.fromDate(finDelDia)),
        orderBy('fecha', 'desc')
      );
    } else {
      // Sin filtros específicos, aplicar límite si se proporciona
      if (limitCount) {
        q = query(collectionRef, orderBy('createdAt', 'desc'), limit(limitCount));
      } else {
        q = query(collectionRef, orderBy('createdAt', 'desc'));
      }
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: data.fecha?.toDate() || new Date(),
        fechaDescuento: data.fechaDescuento?.toDate() || undefined,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Adelanto;
    });
  } catch (error) {
    console.error('Error getting adelantos:', error);
    throw new Error('Error obteniendo adelantos');
  }
};

export const updateAdelanto = async (id: string, adelanto: Partial<Adelanto>) => {
  try {
    // Limpiar campos undefined antes de enviar a Firestore
    const updateData: any = {};
    
    // Solo incluir campos que no sean undefined
    if (adelanto.cajeroId !== undefined) updateData.cajeroId = adelanto.cajeroId;
    if (adelanto.cajeroNombre !== undefined) updateData.cajeroNombre = adelanto.cajeroNombre;
    if (adelanto.fecha !== undefined) updateData.fecha = Timestamp.fromDate(adelanto.fecha);
    if (adelanto.monto !== undefined) updateData.monto = adelanto.monto;
    if (adelanto.concepto !== undefined) updateData.concepto = adelanto.concepto;
    if (adelanto.estado !== undefined) updateData.estado = adelanto.estado;
    if (adelanto.adminId !== undefined) updateData.adminId = adelanto.adminId;
    if (adelanto.adminNombre !== undefined) updateData.adminNombre = adelanto.adminNombre;
    if (adelanto.fechaDescuento !== undefined) {
      updateData.fechaDescuento = adelanto.fechaDescuento ? Timestamp.fromDate(adelanto.fechaDescuento) : null;
    }
    if (adelanto.observaciones !== undefined && adelanto.observaciones.trim() !== '') {
      updateData.observaciones = adelanto.observaciones;
    }
    
    await updateDoc(doc(db, 'adelantos', id), updateData);
  } catch (error) {
    console.error('Error updating adelanto:', error);
    throw new Error('Error actualizando adelanto');
  }
};

export const deleteAdelanto = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'adelantos', id));
  } catch (error) {
    console.error('Error deleting adelanto:', error);
    throw new Error('Error eliminando adelanto');
  }
};

// ============ SISTEMA DE PUNTOS ============

// Premios
export const createPremio = async (premio: Omit<Premio, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'premios'), {
      ...premio,
      createdAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating premio:', error);
    throw new Error('Error creando premio');
  }
};

// Función para obtener premios con paginación
export const getPremios = async (limitCount = 20, searchTerm?: string): Promise<Premio[]> => {
  try {
    let q;
    
    if (searchTerm && searchTerm.trim() !== '') {
      // Si hay búsqueda, cargar todos los premios para filtrar
      q = query(collection(db, 'premios'), orderBy('puntosRequeridos', 'asc'));
    } else {
      // Sin búsqueda, solo cargar los primeros 20
      q = query(collection(db, 'premios'), orderBy('puntosRequeridos', 'asc'), limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    let premios = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Premio;
    });
    
    // Filtrar por término de búsqueda si existe
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      premios = premios.filter(premio => 
        premio.nombre.toLowerCase().includes(searchLower) ||
        premio.descripcion.toLowerCase().includes(searchLower) ||
        premio.tipo.toLowerCase().includes(searchLower)
      );
    }
    
    return premios;
  } catch (error) {
    console.error('Error getting premios:', error);
    throw new Error('Error obteniendo premios');
  }
};

// Función para obtener TODOS los premios (para casos específicos)
export const getAllPremios = async (): Promise<Premio[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'premios'), orderBy('puntosRequeridos', 'asc'))
    );
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Premio;
    });
  } catch (error) {
    console.error('Error getting all premios:', error);
    throw new Error('Error obteniendo todos los premios');
  }
};

export const getPremiosDisponibles = async (puntosCliente: number): Promise<Premio[]> => {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, 'premios'), 
        where('activo', '==', true),
        where('puntosRequeridos', '<=', puntosCliente),
        orderBy('puntosRequeridos', 'asc')
      )
    );
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Premio;
    });
  } catch (error) {
    console.error('Error getting premios disponibles:', error);
    throw new Error('Error obteniendo premios disponibles');
  }
};

export const updatePremio = async (id: string, premio: Partial<Premio>) => {
  try {
    console.log('🔄 Actualizando premio en Firestore:', { id, premio });
    
    // Limpiar datos undefined
    const cleanData: any = {};
    Object.keys(premio).forEach(key => {
      const value = (premio as any)[key];
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    console.log('📝 Datos limpios para actualizar:', cleanData);
    
    const docRef = doc(db, 'premios', id);
    await updateDoc(docRef, cleanData);
    
    console.log('✅ Premio actualizado exitosamente');
  } catch (error) {
    console.error('❌ Error updating premio:', error);
    if (error instanceof Error) {
      throw new Error(`Error actualizando premio: ${error.message}`);
    }
    throw new Error('Error actualizando premio');
  }
};

export const deletePremio = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'premios', id));
  } catch (error) {
    console.error('Error deleting premio:', error);
    throw new Error('Error eliminando premio');
  }
};

// Canjes
// Transacción: si dos cajeros canjean a la vez, Firestore reintenta y vuelve a
// validar los puntos, evitando saldos negativos o canjes duplicados.
export const canjearPuntos = async (clienteId: string, premioId: string, user: User) => {
  try {
    const clienteRef = doc(db, 'clientes', clienteId);
    const premioRef = doc(db, 'premios', premioId);
    const canjeRef = doc(collection(db, 'canjes_puntos'));
    const movimientoRef = doc(collection(db, 'movimientos_puntos'));

    await runTransaction(db, async (tx) => {
      const [clienteDoc, premioDoc] = await Promise.all([tx.get(clienteRef), tx.get(premioRef)]);

      if (!clienteDoc.exists() || !premioDoc.exists()) {
        throw new Error('Cliente o premio no encontrado');
      }

      const clienteData = clienteDoc.data() as Cliente;
      const premioData = premioDoc.data() as Premio;

      if (!premioData.activo) {
        throw new Error('El premio no está activo');
      }
      if ((clienteData.puntos || 0) < premioData.puntosRequeridos) {
        throw new Error('Puntos insuficientes');
      }

      const ahora = Timestamp.fromDate(new Date());
      const cajeroNombre = user.email || 'N/A';

      tx.set(canjeRef, {
        clienteId,
        clienteNombre: clienteData.nombre,
        premioId,
        premioNombre: premioData.nombre,
        puntosUtilizados: premioData.puntosRequeridos,
        cajeroId: user.uid,
        cajeroNombre,
        fecha: ahora,
        estado: 'canjeado',
        createdAt: ahora,
      });
      tx.update(clienteRef, {
        puntos: increment(-premioData.puntosRequeridos),
        puntosCanjeados: increment(premioData.puntosRequeridos),
        updatedAt: serverTimestamp(),
      });
      tx.set(movimientoRef, {
        clienteId,
        clienteNombre: clienteData.nombre,
        tipo: 'canjeados',
        puntos: -premioData.puntosRequeridos,
        motivo: `Canje: ${premioData.nombre}`,
        canjeId: canjeRef.id,
        cajeroId: user.uid,
        cajeroNombre,
        fecha: ahora,
        createdAt: ahora,
      });
    });

    markClientesDirty();
    return canjeRef.id;
  } catch (error) {
    console.error('Error canjeando puntos:', error);
    const conocidos = ['Puntos insuficientes', 'Cliente o premio no encontrado', 'El premio no está activo'];
    if (error instanceof Error && conocidos.includes(error.message)) throw error;
    throw new Error('Error canjeando puntos');
  }
};

export const getCanjesCliente = async (clienteId: string): Promise<CanjeoPuntos[]> => {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, 'canjes_puntos'),
        where('clienteId', '==', clienteId),
        orderBy('createdAt', 'desc')
      )
    );
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: data.fecha?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as CanjeoPuntos;
    });
  } catch (error) {
    console.error('Error getting canjes cliente:', error);
    throw new Error('Error obteniendo canjes del cliente');
  }
};

export const getMovimientosPuntos = async (clienteId: string): Promise<MovimientoPuntos[]> => {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, 'movimientos_puntos'),
        where('clienteId', '==', clienteId),
        orderBy('createdAt', 'desc')
      )
    );
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fecha: data.fecha?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as MovimientoPuntos;
    });
  } catch (error) {
    console.error('Error getting movimientos puntos:', error);
    throw new Error('Error obteniendo movimientos de puntos');
  }
};

// ============ FUNCIONES DE GESTIÓN DE CACHE ============

// Limpia todos los caches relacionados con clientes (uso manual / soporte).
export const clearClientesCache = () => {
  clientesMem = null;
  purgeAppCaches();
  console.log('🧹 Caches de clientes limpiados');
};

// Limpia el cache de servicios (se llama al crear/editar/desactivar servicios).
export const clearServiciosCache = () => {
  safeRemoveItem('servicios-activos');
  safeRemoveItem('servicios-activos-time');
};

// ============ DASHBOARD ============
//
// Ventas del mes en curso con cache en localStorage.
// - Admin: tras la carga inicial del mes solo pide las ventas creadas desde la
//   última consulta (por `createdAt`), en vez de releer todo el mes. Se hace
//   una recarga completa cada hora para reflejar ventas eliminadas.
// - Cajero: recarga completa cada 2 minutos (solo sus ventas, pocas lecturas).

interface DashboardCache {
  mes: string;               // "AAAA-M"
  ventas: Venta[];
  fullLoadAt: number;        // última recarga completa (hora local)
  lastCheckAt: number;       // última consulta (hora local)
}

const DASHBOARD_CAJERO_TTL_MS = 2 * 60 * 1000;
const DASHBOARD_ADMIN_DELTA_MS = 60 * 1000;
const DASHBOARD_ADMIN_FULL_MS = 60 * 60 * 1000;
// Tolerancia a relojes desfasados entre computadoras (createdAt usa hora local).
const DASHBOARD_DELTA_MARGIN_MS = 15 * 60 * 1000;

const dashboardKey = (cajeroId?: string) => `dashboard-${cajeroId || 'admin'}`;

const invalidateDashboardCache = (cajeroId?: string) => {
  if (cajeroId) safeRemoveItem(dashboardKey(cajeroId));
  // La caché admin no se borra: la sincronización incremental recoge las ventas nuevas.
  // Solo se fuerza la consulta del delta en la próxima visita.
  const admin = safeGetJSON<DashboardCache>(dashboardKey());
  if (admin) safeSetItem(dashboardKey(), JSON.stringify({ ...admin, lastCheckAt: 0 }));
};

const reviveVentas = (ventas: Venta[]): Venta[] =>
  ventas.map((v) => ({ ...v, fecha: new Date(v.fecha), createdAt: new Date(v.createdAt) }));

const mapVentaDoc = (id: string, raw: DocumentData): Venta => ({
  id,
  clienteId: raw.clienteId,
  clienteNombre: raw.clienteNombre,
  servicioId: raw.servicioId,
  servicioNombre: raw.servicioNombre,
  precio: Number(raw.precio),
  metodoPago: raw.metodoPago || 'efectivo',
  cajeroId: raw.cajeroId,
  cajeroNombre: raw.cajeroNombre,
  cajeroEmail: raw.cajeroEmail || '',
  fecha: raw.fecha instanceof Timestamp ? raw.fecha.toDate() : new Date('Invalid Date'),
  createdAt: raw.createdAt instanceof Timestamp ? raw.createdAt.toDate() : new Date('Invalid Date'),
});

/** Ventas del mes en curso (con cache). `cajeroId` limita a las ventas de ese cajero. */
export const getVentasMesActual = async (cajeroId?: string): Promise<Venta[]> => {
  const hoy = new Date();
  const mes = `${hoy.getFullYear()}-${hoy.getMonth() + 1}`;
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
  const key = dashboardKey(cajeroId);
  const now = Date.now();

  const stored = safeGetJSON<DashboardCache>(key);
  const cache = stored && stored.mes === mes && Array.isArray(stored.ventas)
    ? { ...stored, ventas: reviveVentas(stored.ventas) }
    : null;

  const guardar = (c: DashboardCache) => {
    safeSetItem(key, JSON.stringify(c));
    return c.ventas;
  };

  if (cajeroId) {
    if (cache && now - cache.fullLoadAt < DASHBOARD_CAJERO_TTL_MS) return cache.ventas;
    const ventas = await getVentas(cajeroId, inicioMes, finMes);
    return guardar({ mes, ventas, fullLoadAt: now, lastCheckAt: now });
  }

  if (!cache || now - cache.fullLoadAt > DASHBOARD_ADMIN_FULL_MS) {
    console.log('📊 Carga completa de ventas del mes');
    const ventas = await getVentas(undefined, inicioMes, finMes);
    return guardar({ mes, ventas, fullLoadAt: now, lastCheckAt: now });
  }

  if (now - cache.lastCheckAt < DASHBOARD_ADMIN_DELTA_MS) return cache.ventas;

  const ultimaCreada = cache.ventas.reduce(
    (max, v) => Math.max(max, isNaN(v.createdAt.getTime()) ? 0 : v.createdAt.getTime()),
    inicioMes.getTime()
  );
  const desde = Timestamp.fromMillis(ultimaCreada - DASHBOARD_DELTA_MARGIN_MS);
  const snapshot = await getDocs(query(collection(db, 'ventas'), where('createdAt', '>', desde)));

  const byId = new Map(cache.ventas.map((v) => [v.id, v]));
  snapshot.docs
    .map((d) => mapVentaDoc(d.id, d.data()))
    .filter((v) => v.fecha >= inicioMes && v.fecha <= finMes)
    .forEach((v) => byId.set(v.id, v));

  const ventas = Array.from(byId.values()).sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  return guardar({ ...cache, ventas, lastCheckAt: now });
};

// Datos del dashboard: ventas del mes (cache) + total de clientes (agregación).
export const getDashboardData = async (cajeroId?: string) => {
  try {
    const [ventas, clientesTotal] = await Promise.all([
      getVentasMesActual(cajeroId),
      getClientesCount(),
    ]);
    return { ventas, clientesTotal, timestamp: Date.now() };
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    throw new Error('Error obteniendo datos del dashboard');
  }
};
