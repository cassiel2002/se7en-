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
  Timestamp,
  getDoc,
  Query
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

// Clientes
export const createCliente = async (cliente: Omit<Cliente, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'clientes'), {
      ...cliente,
      createdAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating cliente:', error);
    throw new Error('Error creando cliente');
  }
};

export const getClientes = async (): Promise<Cliente[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'clientes'), orderBy('createdAt', 'desc'))
    );
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        ultimaVisita: data.ultimaVisita?.toDate() || undefined
      } as Cliente;
    });
  } catch (error) {
    console.error('Error getting clientes:', error);
    throw new Error('Error obteniendo clientes');
  }
};

export const updateCliente = async (id: string, cliente: Partial<Cliente>) => {
  try {
    const updateData = { ...cliente };
    if (updateData.ultimaVisita) {
      updateData.ultimaVisita = Timestamp.fromDate(updateData.ultimaVisita as Date) as any;
    }
    await updateDoc(doc(db, 'clientes', id), updateData);
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

// Función para obtener solo servicios activos (para formularios de Agenda y Ventas)
export const getServiciosActivos = async (): Promise<Servicio[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'servicios'), where('activo', '==', true), orderBy('createdAt', 'desc'))
    );
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Servicio;
    });
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
    console.log('🔍 Tipo de data.fecha antes de addDoc:', typeof ventaDoc.fecha, ventaDoc.fecha);
    console.log('🔍 Tipo de createdAt antes de addDoc:', typeof ventaDoc.createdAt, ventaDoc.createdAt);

    const docRef = await addDoc(collection(db, 'ventas'), ventaDoc);
    
    // Actualizar contador de visitas del cliente
    const clienteRef = doc(db, 'clientes', data.clienteId);
    const clienteDoc = await getDoc(clienteRef);
    
    if (clienteDoc.exists()) {
      const clienteData = clienteDoc.data() as Cliente;
      await updateDoc(clienteRef, {
        visitas: (clienteData.visitas || 0) + 1,
        ultimaVisita: Timestamp.fromDate(new Date())
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating venta:', error);
    throw new Error('Error creando venta');
  }
};

export const getVentas = async (cajeroId?: string, fechaInicio?: Date, fechaFin?: Date): Promise<Venta[]> => {
  try {
    let ventasRef: Query<Venta> = collection(db, 'ventas') as Query<Venta>;
    let q = query(ventasRef, orderBy('fecha', 'desc'));
    
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

export const getAdelantos = async (cajeroId?: string, fecha?: Date, estado?: string, fechaFin?: Date): Promise<Adelanto[]> => {
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
      q = query(collectionRef, where('cajeroId', '==', cajeroId), orderBy('createdAt', 'desc'));
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
      q = query(collectionRef, orderBy('createdAt', 'desc'));
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