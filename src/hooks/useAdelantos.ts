import { useState, useCallback, useEffect } from 'react';
import { UserProfile } from '../firebase/auth';
import { Adelanto, getAdelantos, createAdelanto, updateAdelanto, deleteAdelanto } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface AdelantoData {
  cajeroId: string;
  cajeroNombre: string;
  adelantosPendientes: Adelanto[];
  adelantosDescontados: Adelanto[];
  totalPendiente: number;
  totalDescontado: number;
}

export const useAdelantos = (cajeros: UserProfile[], fechaReporte?: Date, fechaFin?: Date) => {
  const { user, profile } = useAuth();
  const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar adelantos
  const loadAdelantos = useCallback(async () => {
    setLoading(true);
    try {
      // Si es cajero, solo cargar sus propios adelantos
      const cajeroId = profile?.role === 'cashier' ? user?.uid : undefined;
      
      // Si hay fecha fin, cargar adelantos del período completo
      if (fechaFin && fechaReporte) {
        const adelantosData = await getAdelantos(cajeroId, fechaReporte, undefined, fechaFin);
        setAdelantos(adelantosData);
      } else if (fechaReporte) {
        const adelantosData = await getAdelantos(cajeroId, fechaReporte);
        setAdelantos(adelantosData);
      } else {
        const adelantosData = await getAdelantos(cajeroId);
        setAdelantos(adelantosData);
      }
    } catch (error) {
      console.error('Error loading adelantos:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, profile?.role, fechaReporte, fechaFin]);

  useEffect(() => {
    loadAdelantos();
  }, [loadAdelantos]);

  // Calcular datos de adelantos por cajero
  const getAdelantosData = (): AdelantoData[] => {
    return cajeros.map(cajero => {
      const adelantosCajero = adelantos.filter(a => a.cajeroId === cajero.uid);
      const pendientes = adelantosCajero.filter(a => a.estado === 'pendiente');
      const descontados = adelantosCajero.filter(a => a.estado === 'descontado');
      
      return {
        cajeroId: cajero.uid,
        cajeroNombre: cajero.name,
        adelantosPendientes: pendientes,
        adelantosDescontados: descontados,
        totalPendiente: pendientes.reduce((sum, a) => sum + a.monto, 0),
        totalDescontado: descontados.reduce((sum, a) => sum + a.monto, 0)
      };
    });
  };

  // Crear nuevo adelanto
  const crearAdelanto = async (adelanto: Omit<Adelanto, 'id' | 'createdAt' | 'adminId' | 'adminNombre'>) => {
    if (!user || !profile) {
      toast.error('No hay usuario autenticado');
      return;
    }

    try {
      await createAdelanto({
        ...adelanto,
        adminId: user.uid,
        adminNombre: profile.name
      });
      toast.success('Adelanto creado exitosamente');
      await loadAdelantos();
    } catch (error) {
      console.error('Error creating adelanto:', error);
      toast.error('Error creando adelanto');
    }
  };

  // Marcar adelanto como descontado
  const marcarComoDescontado = async (adelantoId: string) => {
    try {
      await updateAdelanto(adelantoId, {
        estado: 'descontado',
        fechaDescuento: new Date()
      });
      toast.success('Adelanto marcado como descontado');
      await loadAdelantos();
    } catch (error) {
      console.error('Error updating adelanto:', error);
      toast.error('Error actualizando adelanto');
    }
  };

  // Eliminar adelanto
  const eliminarAdelanto = async (adelantoId: string) => {
    try {
      await deleteAdelanto(adelantoId);
      toast.success('Adelanto eliminado');
      await loadAdelantos();
    } catch (error) {
      console.error('Error deleting adelanto:', error);
      toast.error('Error eliminando adelanto');
    }
  };

  return {
    adelantos,
    loading,
    getAdelantosData,
    crearAdelanto,
    marcarComoDescontado,
    eliminarAdelanto,
    loadAdelantos
  };
}; 