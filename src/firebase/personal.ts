// Personal: perfiles de cajeros, plus manuales y adelantos.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import { errorConCodigo } from '../utils/firebaseErrors';
import { Adelanto, PlusManual } from './types';

// Perfiles de cajeros
export const deleteCajeroProfile = async (uid: string) => {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.error('Error deleting cashier profile:', error);
    throw errorConCodigo('Error eliminando perfil de cajero', error);
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
    throw errorConCodigo('Error creando plus manual', error);
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
          const data = doc.data() as DocumentData;
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
    throw errorConCodigo('Error eliminando plus manual', error);
  }
};

// Adelantos
export const createAdelanto = async (adelanto: Omit<Adelanto, 'id' | 'createdAt'>) => {
  try {
    // Limpiar campos undefined antes de enviar a Firestore
    const adelantoData: DocumentData = {
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
    throw errorConCodigo('Error creando adelanto', error);
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
    throw errorConCodigo('Error obteniendo adelantos', error);
  }
};

export const updateAdelanto = async (id: string, adelanto: Partial<Adelanto>) => {
  try {
    // Limpiar campos undefined antes de enviar a Firestore
    const updateData: DocumentData = {};
    
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
    throw errorConCodigo('Error actualizando adelanto', error);
  }
};

export const deleteAdelanto = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'adelantos', id));
  } catch (error) {
    console.error('Error deleting adelanto:', error);
    throw errorConCodigo('Error eliminando adelanto', error);
  }
};
