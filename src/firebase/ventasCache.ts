// Cache local de las ventas del mes de un cajero (para su dashboard).
// Módulo separado para que ventas.ts y dashboard.ts no dependan entre sí.
import { Venta } from './types';
import { safeGetJSON, safeRemoveItem, safeSetItem } from '../utils/safeStorage';

interface VentasCajeroCache {
  mes: string; // "AAAA-M"
  ventas: Venta[];
  cargadoEn: number;
}

export const VENTAS_CAJERO_TTL_MS = 2 * 60 * 1000;

const clave = (cajeroId: string) => `dashboard-${cajeroId}`;

export const leerVentasCajero = (cajeroId: string, mes: string): Venta[] | null => {
  const cache = safeGetJSON<VentasCajeroCache>(clave(cajeroId));
  if (!cache || cache.mes !== mes || !Array.isArray(cache.ventas)) return null;
  if (Date.now() - cache.cargadoEn > VENTAS_CAJERO_TTL_MS) return null;
  return cache.ventas.map((v) => ({ ...v, fecha: new Date(v.fecha), createdAt: new Date(v.createdAt) }));
};

export const guardarVentasCajero = (cajeroId: string, mes: string, ventas: Venta[]) => {
  safeSetItem(clave(cajeroId), JSON.stringify({ mes, ventas, cargadoEn: Date.now() }));
};

export const invalidarVentasCajero = (cajeroId: string) => safeRemoveItem(clave(cajeroId));

// Contador que cambia cada vez que esta pestaña registra o elimina una venta,
// para descartar estadísticas en memoria.
let epocaVentas = 0;
export const marcarVentasCambiadas = () => {
  epocaVentas++;
};
export const getEpocaVentas = () => epocaVentas;
