// Turnos (agenda).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import { errorConCodigo } from '../utils/firebaseErrors';
import { Turno } from './types';
import { sinUndefined } from './converters';

export const createTurno = async (turno: Omit<Turno, 'id' | 'createdAt'>) => {
  try {
    // Validar que todos los campos requeridos estén presentes
    if (!turno.cajeroId || !turno.cajeroNombre) {
      throw new Error('Información del cajero no disponible');
    }

    const docRef = await addDoc(collection(db, 'turnos'), {
      ...turno,
      fecha: Timestamp.fromDate(turno.fecha),
      createdAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating turno:', error);
    throw errorConCodigo('Error creando turno', error);
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
    throw errorConCodigo('Error obteniendo turnos', error);
  }
};

export const updateTurno = async (id: string, turno: Partial<Turno>) => {
  try {
    const { fecha, id: _ignorado, ...resto } = turno;
    void _ignorado;
    await updateDoc(doc(db, 'turnos', id), {
      ...sinUndefined(resto),
      ...(fecha ? { fecha: Timestamp.fromDate(fecha) } : {}),
    });
  } catch (error) {
    console.error('Error updating turno:', error);
    throw errorConCodigo('Error actualizando turno', error);
  }
};

export const deleteTurno = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'turnos', id));
  } catch (error) {
    console.error('Error deleting turno:', error);
    throw errorConCodigo('Error eliminando turno', error);
  }
};
