// Sistema de puntos: premios y canjes.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './config';
import { errorConCodigo } from '../utils/firebaseErrors';
import { Cliente, Premio } from './types';
import { sinUndefined } from './converters';
import { markClientesDirty } from './clientes';

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
    throw errorConCodigo('Error creando premio', error);
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
    throw errorConCodigo('Error obteniendo premios', error);
  }
};

export const updatePremio = async (id: string, premio: Partial<Premio>) => {
  try {
    const { id: _ignorado, ...datos } = premio;
    void _ignorado;
    await updateDoc(doc(db, 'premios', id), sinUndefined(datos));
  } catch (error) {
    console.error('Error updating premio:', error);
    throw errorConCodigo('Error actualizando premio', error);
  }
};

export const deletePremio = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'premios', id));
  } catch (error) {
    console.error('Error deleting premio:', error);
    throw errorConCodigo('Error eliminando premio', error);
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
        ultimoCanjeId: canjeRef.id,
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
    throw errorConCodigo('Error canjeando puntos', error);
  }
};

