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
  startAfter,
  Timestamp,
  getDoc,
  Query,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from './config';
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
}

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

// Clientes
export const createCliente = async (cliente: Omit<Cliente, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...cliente,
      puntos: 0,
      puntosCanjeados: 0,
      createdAt: Timestamp.fromDate(new Date())
    });
    
    // Limpiar TODOS los caches de clientes cuando se crea uno nuevo
    const today = new Date().toDateString();
    
    // Cache del contador
    localStorage.removeItem('clientes-count');
    localStorage.removeItem('clientes-count-time');
    
    // Cache de lista completa (para ventas)
    localStorage.removeItem(`clientes-todos-${today}`);
    localStorage.removeItem(`clientes-todos-time-${today}`);
    
    // Cache de dashboard
    localStorage.removeItem('dashboard-admin');
    localStorage.removeItem('dashboard-time-admin');
    
    console.log('🧹 Todos los caches de clientes limpiados por nuevo cliente');
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating cliente:', error);
    throw new Error('Error creando cliente');
  }
};

// Función para obtener TODOS los clientes (para formularios y búsquedas)
// Función para obtener TODOS los clientes CON CACHE DIARIO (para formularios de ventas)
export const getClientes = async (): Promise<Cliente[]> => {
  try {
    const cacheKey = `clientes-todos-${new Date().toDateString()}`;
    const cacheTimeKey = `clientes-todos-time-${new Date().toDateString()}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    
    // Cache válido por 1 día (hasta medianoche)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(23, 59, 59, 999);
    
    if (cached && cacheTime && Date.now() < midnight.getTime()) {
      const clientesFromCache = JSON.parse(cached);
      console.log(`👥 Usando lista completa de clientes desde cache diario (${clientesFromCache.length} clientes) - AHORRO DE LECTURAS`);
      return clientesFromCache;
    }
    
    // Cache expirado o no existe - consultar Firebase
    console.log('👥 Consultando lista completa de clientes desde Firebase (primera vez del día) - USANDO LECTURAS');
    
    // Intentar ordenar por nombre, si falla usar createdAt
    let querySnapshot;
    try {
      querySnapshot = await getDocs(
        query(collection(db, 'clientes'), orderBy('nombre', 'asc'))
      );
    } catch (indexError) {
      console.log('Índice por nombre no disponible, usando createdAt');
      querySnapshot = await getDocs(
        query(collection(db, 'clientes'), orderBy('createdAt', 'desc'))
      );
    }
    
    let clientes = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        ultimaVisita: data.ultimaVisita?.toDate() || undefined
      } as Cliente;
    });
    
    // Ordenar por nombre en el cliente si no se pudo hacer en la consulta
    clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Guardar en cache hasta medianoche
    localStorage.setItem(cacheKey, JSON.stringify(clientes));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    
    return clientes;
  } catch (error) {
    console.error('Error getting clientes:', error);
    throw new Error('Error obteniendo clientes');
  }
};

// Función para obtener clientes con paginación (solo para listas)
export const getClientesPaginados = async (limitCount = 20, searchTerm?: string): Promise<Cliente[]> => {
  try {
    let querySnapshot;
    
    if (searchTerm && searchTerm.trim() !== '') {
      // Si hay búsqueda, cargar TODOS los clientes para filtrar
      try {
        querySnapshot = await getDocs(
          query(collection(db, 'clientes'), orderBy('nombre', 'asc'))
        );
      } catch (indexError) {
        console.log('Índice por nombre no disponible, usando createdAt para búsqueda');
        querySnapshot = await getDocs(
          query(collection(db, 'clientes'), orderBy('createdAt', 'desc'))
        );
      }
    } else {
      // Sin búsqueda, solo cargar los últimos 20 por fecha de creación
      querySnapshot = await getDocs(
        query(collection(db, 'clientes'), orderBy('createdAt', 'desc'), limit(limitCount))
      );
    }
    
    let clientes = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        ultimaVisita: data.ultimaVisita?.toDate() || undefined
      } as Cliente;
    });
    
    // Filtrar por término de búsqueda si existe
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      clientes = clientes.filter(cliente => 
        cliente.nombre.toLowerCase().includes(searchLower) ||
        cliente.telefono.includes(searchTerm) ||
        (cliente.email && cliente.email.toLowerCase().includes(searchLower)) ||
        (cliente.dni && cliente.dni.includes(searchTerm))
      );
      
      // Reordenar por relevancia: coincidencias exactas primero
      clientes.sort((a, b) => {
        const aNameMatch = a.nombre.toLowerCase().startsWith(searchLower);
        const bNameMatch = b.nombre.toLowerCase().startsWith(searchLower);
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        return a.nombre.localeCompare(b.nombre);
      });
    } else {
      // Sin búsqueda, ordenar por fecha de creación (más recientes primero)
      clientes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    
    return clientes;
  } catch (error) {
    console.error('Error getting clientes paginados:', error);
    throw new Error('Error obteniendo clientes paginados');
  }
};

// Función para contar el total de clientes CON CACHE
export const getClientesCount = async (): Promise<number> => {
  try {
    const cacheKey = 'clientes-count';
    const cacheTimeKey = 'clientes-count-time';
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    
    // Cache válido por 6 horas (21,600,000 ms)
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 6 * 60 * 60 * 1000) {
      console.log('📊 Usando contador de clientes desde cache');
      return parseInt(cached);
    }
    
    // Cache expirado o no existe - consultar Firebase
    console.log('📊 Consultando contador de clientes desde Firebase');
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    const count = querySnapshot.size;
    
    // Guardar en cache
    localStorage.setItem(cacheKey, count.toString());
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    
    return count;
  } catch (error) {
    console.error('Error counting clientes:', error);
    return 0;
  }
};

export const updateCliente = async (id: string, cliente: Partial<Cliente>) => {
  try {
    const updateData = { ...cliente };
    if (updateData.ultimaVisita) {
      updateData.ultimaVisita = Timestamp.fromDate(updateData.ultimaVisita as Date) as any;
    }
    await updateDoc(doc(db, 'clientes', id), updateData);
    
    // Limpiar cache de lista completa cuando se modifica un cliente
    const today = new Date().toDateString();
    localStorage.removeItem(`clientes-todos-${today}`);
    localStorage.removeItem(`clientes-todos-time-${today}`);
    
    console.log('🧹 Cache de lista de clientes limpiado por actualización');
    
  } catch (error) {
    console.error('Error updating cliente:', error);
    throw new Error('Error actualizando cliente');
  }
};

export const deleteCliente = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'clientes', id));
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
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    
    // Cache válido por 1 día (86,400,000 ms)
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 24 * 60 * 60 * 1000) {
      console.log('🔧 Usando servicios activos desde cache');
      return JSON.parse(cached);
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
    localStorage.setItem(cacheKey, JSON.stringify(servicios));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    
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
  } catch (error) {
    console.error('Error updating servicio:', error);
    throw new Error('Error actualizando servicio');
  }
};

// Ventas
export const createVenta = async (data: Omit<Venta, 'id' | 'createdAt' | 'cajeroId' | 'cajeroEmail'>, user: User) => {
  try {
    if (!user?.uid || !user.email) {
      console.error("❌ Datos del cajero faltantes: ", user);
      throw new Error("Información del cajero no disponible");
    }

    const ventaDoc = {
      ...data,
      cajeroId: user.uid,
      cajeroNombre: data.cajeroNombre && data.cajeroNombre !== 'Desconocido' ? data.cajeroNombre : user.email || 'N/A',
      cajeroEmail: user.email,
      fecha: Timestamp.fromDate(data.fecha),
      createdAt: Timestamp.fromDate(new Date()),
    };

    console.log('✅ Creando venta con datos:', ventaDoc);

    const docRef = await addDoc(collection(db, 'ventas'), ventaDoc);
    
    // Limpiar cache del dashboard para que se actualice con la nueva venta
    localStorage.removeItem('dashboard-admin');
    localStorage.removeItem('dashboard-time-admin');
    localStorage.removeItem(`dashboard-${user.uid}`);
    localStorage.removeItem(`dashboard-time-${user.uid}`);
    console.log('🧹 Cache del dashboard limpiado por nueva venta');
    
    // Actualizar contador de visitas y puntos del cliente
    const clienteRef = doc(db, 'clientes', data.clienteId);
    const clienteDoc = await getDoc(clienteRef);
    
    if (clienteDoc.exists()) {
      const clienteData = clienteDoc.data() as Cliente;
      const nuevosVisitas = (clienteData.visitas || 0) + 1;
      const nuevosPuntos = (clienteData.puntos || 0) + 1; // +1 punto por corte
      
      await updateDoc(clienteRef, {
        visitas: nuevosVisitas,
        puntos: nuevosPuntos,
        ultimaVisita: Timestamp.fromDate(new Date())
      });

      // Registrar movimiento de puntos
      await addDoc(collection(db, 'movimientos_puntos'), {
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre,
        tipo: 'ganados',
        puntos: 1,
        motivo: `Corte: ${data.servicioNombre}`,
        ventaId: docRef.id,
        cajeroId: user.uid,
        cajeroNombre: ventaDoc.cajeroNombre,
        fecha: Timestamp.fromDate(new Date()),
        createdAt: Timestamp.fromDate(new Date())
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating venta:', error);
    throw new Error('Error creando venta');
  }
};

export const getVentas = async (cajeroId?: string, fechaInicio?: Date, fechaFin?: Date, limitCount = 20, searchTerm?: string): Promise<Venta[]> => {
  try {
    let ventasRef: Query<Venta> = collection(db, 'ventas') as Query<Venta>;
    let q = query(ventasRef, orderBy('fecha', 'desc'));
    
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
    let ventas = querySnapshot.docs.map(doc => {
      const rawData = doc.data();
      const venta: Venta = {
        id: doc.id,
        clienteId: rawData.clienteId as string,
        clienteNombre: rawData.clienteNombre as string,
        servicioId: rawData.servicioId as string,
        servicioNombre: rawData.servicioNombre as string,
        precio: Number(rawData.precio),
        metodoPago: (rawData.metodoPago as 'efectivo' | 'transferencia') || 'efectivo',
        cajeroId: rawData.cajeroId as string,
        cajeroNombre: rawData.cajeroNombre as string,
        cajeroEmail: (rawData.cajeroEmail as string) || '',
        fecha: (rawData.fecha instanceof Timestamp) ? rawData.fecha.toDate() : new Date('Invalid Date'),
        createdAt: (rawData.createdAt instanceof Timestamp) ? rawData.createdAt.toDate() : new Date('Invalid Date'),
      };
      return venta;
    });
    
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
      role: 'cajero' // Asegurar que el rol sea 'cajero'
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
export const canjearPuntos = async (clienteId: string, premioId: string, user: User) => {
  try {
    // Obtener datos del cliente y premio
    const clienteDoc = await getDoc(doc(db, 'clientes', clienteId));
    const premioDoc = await getDoc(doc(db, 'premios', premioId));
    
    if (!clienteDoc.exists() || !premioDoc.exists()) {
      throw new Error('Cliente o premio no encontrado');
    }
    
    const clienteData = clienteDoc.data() as Cliente;
    const premioData = premioDoc.data() as Premio;
    
    // Verificar puntos suficientes
    if (clienteData.puntos < premioData.puntosRequeridos) {
      throw new Error('Puntos insuficientes');
    }
    
    // Crear registro de canje
    const canjeDoc = {
      clienteId,
      clienteNombre: clienteData.nombre,
      premioId,
      premioNombre: premioData.nombre,
      puntosUtilizados: premioData.puntosRequeridos,
      cajeroId: user.uid,
      cajeroNombre: user.email || 'N/A',
      fecha: Timestamp.fromDate(new Date()),
      estado: 'canjeado' as const,
      createdAt: Timestamp.fromDate(new Date())
    };
    
    const canjeRef = await addDoc(collection(db, 'canjes_puntos'), canjeDoc);
    
    // Restar solo los puntos del premio, conservar el resto
    const puntosRestantes = clienteData.puntos - premioData.puntosRequeridos;
    const nuevosPuntosCanjeados = (clienteData.puntosCanjeados || 0) + premioData.puntosRequeridos;
    
    await updateDoc(doc(db, 'clientes', clienteId), {
      puntos: puntosRestantes,
      puntosCanjeados: nuevosPuntosCanjeados
    });
    
    // Registrar movimiento de puntos
    await addDoc(collection(db, 'movimientos_puntos'), {
      clienteId,
      clienteNombre: clienteData.nombre,
      tipo: 'canjeados',
      puntos: -premioData.puntosRequeridos, // Solo los puntos del premio
      motivo: `Canje: ${premioData.nombre}`,
      canjeId: canjeRef.id,
      cajeroId: user.uid,
      cajeroNombre: user.email || 'N/A',
      fecha: Timestamp.fromDate(new Date()),
      createdAt: Timestamp.fromDate(new Date())
    });
    
    return canjeRef.id;
  } catch (error) {
    console.error('Error canjeando puntos:', error);
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

// Función para limpiar todos los caches relacionados con clientes
export const clearClientesCache = () => {
  const today = new Date().toDateString();
  
  // Cache del contador
  localStorage.removeItem('clientes-count');
  localStorage.removeItem('clientes-count-time');
  
  // Cache de lista completa
  localStorage.removeItem(`clientes-todos-${today}`);
  localStorage.removeItem(`clientes-todos-time-${today}`);
  
  // Cache de dashboard
  localStorage.removeItem('dashboard-admin');
  localStorage.removeItem('dashboard-time-admin');
  
  console.log('🧹 Todos los caches de clientes limpiados manualmente');
};

// Función para limpiar cache de servicios (cuando admin los modifica)
export const clearServiciosCache = () => {
  localStorage.removeItem('servicios-activos');
  localStorage.removeItem('servicios-activos-time');
  console.log('🧹 Cache de servicios limpiado');
};

// ============ FUNCIONES CON CACHE PARA DASHBOARD ============

// Función para obtener datos del dashboard CON CACHE (2 minutos)
export const getDashboardData = async (cajeroId?: string) => {
  try {
    const cacheKey = `dashboard-${cajeroId || 'admin'}`;
    const cacheTimeKey = `dashboard-time-${cajeroId || 'admin'}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    
    // Cache válido por 2 minutos (120,000 ms) - reducido para datos más frescos
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 2 * 60 * 1000) {
      console.log('📊 Usando datos de dashboard desde cache');
      const parsedCache = JSON.parse(cached);
      // Convertir fechas de string a Date
      parsedCache.ventas = parsedCache.ventas.map((v: any) => ({
        ...v,
        fecha: new Date(v.fecha),
        createdAt: new Date(v.createdAt)
      }));
      return parsedCache;
    }
    
    // Cache expirado o no existe - consultar Firebase
    console.log('📊 Consultando datos de dashboard desde Firebase');
    
    // Obtener inicio del mes actual para cargar ventas relevantes
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const [ventasData, clientesData] = await Promise.all([
      // Cargar ventas del mes actual (sin límite estricto para dashboard)
      getVentas(cajeroId, inicioMes, finMes, 500),
      getClientesPaginados(20)
    ]);
    
    const dashboardData = {
      ventas: ventasData,
      clientes: clientesData,
      timestamp: Date.now()
    };
    
    // Guardar en cache
    localStorage.setItem(cacheKey, JSON.stringify(dashboardData));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    
    return dashboardData;
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    throw new Error('Error obteniendo datos del dashboard');
  }
};

