import { useState, useEffect, useCallback } from 'react';
import { getPlusManuales, createPlusManual, deletePlusManual, PlusManual } from '../firebase/firestore';
import { UserProfile } from '../firebase/auth';
import { eachDayOfInterval, isSunday } from 'date-fns';

export interface PlusData {
  cajeroId: string;
  cajeroNombre: string;
  plusAutomatico: number;      // Plus diario por ser encargado (multiplicado por días del período)
  plusManual: number;          // Plus manual del período
  totalPlus: number;           // Plus automático + manual
  plusManualesDetalle: PlusManual[]; // Plus manuales individuales del período
}

export const usePlus = (cajeros: UserProfile[], fechaReporte: Date, fechaFin?: Date) => {
  const [plusManuales, setPlusManuales] = useState<PlusManual[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar plus manuales del período del reporte
  const loadPlusManuales = useCallback(async () => {
    setLoading(true);
    try {
      // Si hay fecha fin, cargar plus de todo el período
      if (fechaFin) {
        const plus = await getPlusManuales(undefined, fechaReporte, fechaFin);
        setPlusManuales(plus);
      } else {
        // Solo del día específico
        const plus = await getPlusManuales(undefined, fechaReporte);
        setPlusManuales(plus);
      }
    } catch (error) {
      console.error('Error loading plus manuales:', error);
    } finally {
      setLoading(false);
    }
  }, [fechaReporte, fechaFin]);

  useEffect(() => {
    loadPlusManuales();
  }, [loadPlusManuales]);

  // Calcular plus por cajero
  const getPlusData = (): PlusData[] => {
    return cajeros.map(cajero => {
      // Calcular días del período excluyendo domingos
      let diasPeriodo = 1;
      if (fechaFin) {
        const diasIntervalo = eachDayOfInterval({ start: fechaReporte, end: fechaFin });
        diasPeriodo = diasIntervalo.filter(dia => !isSunday(dia)).length;
      }
      
      // Plus automático: si es encargado y está activo, multiplicar por días del período (sin domingos)
      const plusDiario = (cajero.isEncargado && cajero.plusEncargadoActivo) 
        ? (cajero.plusEncargado || 0) 
        : 0;
      
      const plusAutomatico = plusDiario * diasPeriodo;

      // Plus manual: buscar en los plus del período
      const plusManualesDelCajero = plusManuales.filter(p => p.cajeroId === cajero.uid);
      const plusManualPeriodo = plusManualesDelCajero.reduce((sum, p) => sum + p.monto, 0);

      return {
        cajeroId: cajero.uid,
        cajeroNombre: cajero.name,
        plusAutomatico,
        plusManual: plusManualPeriodo,
        totalPlus: plusAutomatico + plusManualPeriodo,
        plusManualesDetalle: plusManualesDelCajero
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

  // Eliminar plus manual
  const eliminarPlusManual = async (plusId: string) => {
    try {
      await deletePlusManual(plusId);
      // Recargar plus manuales
      await loadPlusManuales();
      return true;
    } catch (error) {
      console.error('Error eliminando plus manual:', error);
      return false;
    }
  };

  return {
    plusData: getPlusData(),
    loading,
    agregarPlusManual,
    eliminarPlusManual,
    reloadPlus: loadPlusManuales
  };
}; 