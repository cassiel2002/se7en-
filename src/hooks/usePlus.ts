import { useState, useEffect, useCallback } from 'react';
import { getPlusManuales, createPlusManual, PlusManual } from '../firebase/firestore';
import { UserProfile } from '../firebase/auth';

export interface PlusData {
  cajeroId: string;
  cajeroNombre: string;
  plusAutomatico: number;      // Plus diario por ser encargado
  plusManual: number;          // Plus manual del día
  totalPlus: number;           // Plus automático + manual
}

export const usePlus = (cajeros: UserProfile[], fechaReporte: Date) => {
  const [plusManuales, setPlusManuales] = useState<PlusManual[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar plus manuales del día del reporte
  const loadPlusManuales = useCallback(async () => {
    setLoading(true);
    try {
      const plus = await getPlusManuales(undefined, fechaReporte);
      setPlusManuales(plus);
    } catch (error) {
      console.error('Error loading plus manuales:', error);
    } finally {
      setLoading(false);
    }
  }, [fechaReporte]);

  useEffect(() => {
    loadPlusManuales();
  }, [loadPlusManuales]);

  // Calcular plus por cajero
  const getPlusData = (): PlusData[] => {
    return cajeros.map(cajero => {
      // Plus automático: si es encargado y está activo
      const plusAutomatico = (cajero.isEncargado && cajero.plusEncargadoActivo) 
        ? (cajero.plusEncargado || 0) 
        : 0;

      // Plus manual: buscar en los plus del día
      const plusManualHoy = plusManuales
        .filter(p => p.cajeroId === cajero.uid)
        .reduce((sum, p) => sum + p.monto, 0);

      return {
        cajeroId: cajero.uid,
        cajeroNombre: cajero.name,
        plusAutomatico,
        plusManual: plusManualHoy,
        totalPlus: plusAutomatico + plusManualHoy
      };
    });
  };

  // Agregar plus manual
  const agregarPlusManual = async (
    cajeroId: string, 
    cajeroNombre: string,
    monto: number, 
    motivo: string,
    adminId: string,
    adminNombre: string
  ) => {
    try {
      await createPlusManual({
        cajeroId,
        cajeroNombre,
        fecha: fechaReporte,
        monto,
        motivo,
        adminId,
        adminNombre
      });
      
      // Recargar plus manuales
      await loadPlusManuales();
      return true;
    } catch (error) {
      console.error('Error agregando plus manual:', error);
      return false;
    }
  };

  return {
    plusData: getPlusData(),
    loading,
    agregarPlusManual,
    reloadPlus: loadPlusManuales
  };
}; 