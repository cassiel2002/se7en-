// Estadísticas de ventas del mes en curso para el Dashboard y el rendimiento de cajeros.
//
// - Admin: lee los resúmenes diarios (~30 documentos por mes). La primera vez
//   (sin `config/resumenes`) los genera a partir de las ventas del mes.
// - Cajero: calcula sobre sus propias ventas del mes (pocas; cache de 2 minutos).
import { endOfMonth, startOfMonth } from 'date-fns';
import { ResumenVentasDia } from './types';
import { errorConCodigo } from '../utils/firebaseErrors';
import { getVentas } from './ventas';
import { getClientesCount } from './clientes';
import {
  calcularResumenes,
  claveDia,
  combinarResumenes,
  getResumenesDesde,
  getResumenesRango,
  inicializarResumenes,
} from './resumenes';
import { getEpocaVentas, guardarVentasCajero, leerVentasCajero } from './ventasCache';

export interface EstadisticasVentas {
  /** Totales de hoy. */
  hoy: ResumenVentasDia;
  /** Totales del mes en curso. */
  mes: ResumenVentasDia;
}

const ESTADISTICAS_TTL_MS = 60 * 1000;
let estadisticasAdminMem: { clave: string; epoca: number; en: number; dias: ResumenVentasDia[] } | null = null;
let resumenesDesdeMem: string | null = null;

const estadisticasDesdeDias = (dias: ResumenVentasDia[], hoy: Date): EstadisticasVentas => {
  const claveHoy = claveDia(hoy);
  return {
    hoy: combinarResumenes(dias.filter((d) => d.fecha === claveHoy)),
    mes: combinarResumenes(dias),
  };
};

let diasAdminEnCurso: Promise<ResumenVentasDia[]> | null = null;

/** Evita cargas (e inicializaciones) simultáneas desde varios componentes. */
const diasDelMesAdmin = (inicioMes: Date, finMes: Date): Promise<ResumenVentasDia[]> => {
  if (!diasAdminEnCurso) {
    diasAdminEnCurso = cargarDiasDelMesAdmin(inicioMes, finMes).finally(() => {
      diasAdminEnCurso = null;
    });
  }
  return diasAdminEnCurso;
};

const cargarDiasDelMesAdmin = async (inicioMes: Date, finMes: Date): Promise<ResumenVentasDia[]> => {
  const claveMes = claveDia(inicioMes);
  if (
    estadisticasAdminMem &&
    estadisticasAdminMem.clave === claveMes &&
    estadisticasAdminMem.epoca === getEpocaVentas() &&
    Date.now() - estadisticasAdminMem.en < ESTADISTICAS_TTL_MS
  ) {
    return estadisticasAdminMem.dias;
  }

  if (!resumenesDesdeMem || resumenesDesdeMem > claveMes) {
    resumenesDesdeMem = await getResumenesDesde();
  }

  let dias: ResumenVentasDia[];
  if (resumenesDesdeMem && resumenesDesdeMem <= claveMes) {
    dias = await getResumenesRango(inicioMes, finMes);
  } else {
    // Primera vez: calcular desde las ventas del mes y dejar los resúmenes creados.
    const ventas = await getVentas(undefined, inicioMes, finMes);
    dias = Array.from(calcularResumenes(ventas).values());
    try {
      await inicializarResumenes(ventas, inicioMes);
      resumenesDesdeMem = claveMes;
      console.info('Resúmenes de ventas inicializados desde', claveMes);
    } catch (error) {
      console.warn('No se pudieron inicializar los resúmenes de ventas:', error);
    }
  }

  estadisticasAdminMem = { clave: claveMes, epoca: getEpocaVentas(), en: Date.now(), dias };
  return dias;
};

const ventasDelMesCajero = async (cajeroId: string, inicioMes: Date, finMes: Date) => {
  const mes = claveDia(inicioMes);
  const cache = leerVentasCajero(cajeroId, mes);
  if (cache) return cache;
  const ventas = await getVentas(cajeroId, inicioMes, finMes);
  guardarVentasCajero(cajeroId, mes, ventas);
  return ventas;
};

/** Estadísticas del mes en curso. Con `cajeroId`, solo las ventas de ese cajero. */
export const getEstadisticasMes = async (cajeroId?: string): Promise<EstadisticasVentas> => {
  const hoy = new Date();
  const inicioMes = startOfMonth(hoy);
  const finMes = endOfMonth(hoy);

  if (cajeroId) {
    const ventas = await ventasDelMesCajero(cajeroId, inicioMes, finMes);
    return estadisticasDesdeDias(Array.from(calcularResumenes(ventas).values()), hoy);
  }
  return estadisticasDesdeDias(await diasDelMesAdmin(inicioMes, finMes), hoy);
};

export interface DashboardData {
  estadisticas: EstadisticasVentas;
  clientesTotal: number;
}

export const getDashboardData = async (cajeroId?: string): Promise<DashboardData> => {
  try {
    const [estadisticas, clientesTotal] = await Promise.all([
      getEstadisticasMes(cajeroId),
      getClientesCount(),
    ]);
    return { estadisticas, clientesTotal };
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    throw errorConCodigo('Error obteniendo datos del dashboard', error);
  }
};
