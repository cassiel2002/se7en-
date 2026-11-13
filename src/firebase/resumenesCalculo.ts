// Cálculo de resúmenes de ventas (sin acceso a red: no usa la instancia de Firestore).
import { format } from 'date-fns';
import { increment, serverTimestamp } from 'firebase/firestore';
import { ResumenVentasDia, TotalesCajero, TotalesServicio, Venta } from './types';

/** Clave del día en hora local: "AAAA-MM-DD". */
export const claveDia = (fecha: Date): string => format(fecha, 'yyyy-MM-dd');

const vacio = (fecha: string): ResumenVentasDia => ({
  fecha,
  total: 0,
  cantidad: 0,
  porCajero: {},
  porServicio: {},
});

const sumarServicio = (
  destino: Record<string, TotalesServicio>,
  id: string,
  nombre: string,
  cantidad: number,
  total: number
) => {
  const actual = destino[id] || { nombre, cantidad: 0, total: 0 };
  destino[id] = { nombre: actual.nombre || nombre, cantidad: actual.cantidad + cantidad, total: actual.total + total };
};

/** Calcula los resúmenes por día a partir de una lista de ventas (función pura). */
export const calcularResumenes = (ventas: Venta[]): Map<string, ResumenVentasDia> => {
  const porDia = new Map<string, ResumenVentasDia>();
  for (const v of ventas) {
    if (!(v.fecha instanceof Date) || isNaN(v.fecha.getTime())) continue;
    const clave = claveDia(v.fecha);
    const dia = porDia.get(clave) || vacio(clave);
    dia.total += v.precio;
    dia.cantidad += 1;
    const cajero: TotalesCajero = dia.porCajero[v.cajeroId] || {
      nombre: v.cajeroNombre,
      cantidad: 0,
      total: 0,
      servicios: {},
    };
    cajero.cantidad += 1;
    cajero.total += v.precio;
    sumarServicio(cajero.servicios, v.servicioId, v.servicioNombre, 1, v.precio);
    dia.porCajero[v.cajeroId] = cajero;
    sumarServicio(dia.porServicio, v.servicioId, v.servicioNombre, 1, v.precio);
    porDia.set(clave, dia);
  }
  return porDia;
};

/** Combina varios días en un único total (función pura). */
export const combinarResumenes = (dias: ResumenVentasDia[]): ResumenVentasDia => {
  const total = vacio('');
  for (const dia of dias) {
    total.total += dia.total || 0;
    total.cantidad += dia.cantidad || 0;
    for (const [id, s] of Object.entries(dia.porServicio || {})) {
      sumarServicio(total.porServicio, id, s.nombre, s.cantidad || 0, s.total || 0);
    }
    for (const [uid, c] of Object.entries(dia.porCajero || {})) {
      const acumulado = total.porCajero[uid] || { nombre: c.nombre, cantidad: 0, total: 0, servicios: {} };
      acumulado.cantidad += c.cantidad || 0;
      acumulado.total += c.total || 0;
      for (const [id, s] of Object.entries(c.servicios || {})) {
        sumarServicio(acumulado.servicios, id, s.nombre, s.cantidad || 0, s.total || 0);
      }
      total.porCajero[uid] = acumulado;
    }
  }
  return total;
};

type DatosVentaResumen = Pick<
  Venta,
  'fecha' | 'precio' | 'cajeroId' | 'cajeroNombre' | 'servicioId' | 'servicioNombre'
>;

/**
 * Datos para `setDoc(resumenRef, datos, { merge: true })` que suman (signo 1)
 * o restan (signo -1) una venta en el resumen de su día.
 */
export const incrementoResumen = (venta: DatosVentaResumen, ventaId: string, signo: 1 | -1) => {
  const importe = signo * venta.precio;
  const servicio = {
    nombre: venta.servicioNombre,
    cantidad: increment(signo),
    total: increment(importe),
  };
  return {
    fecha: claveDia(venta.fecha),
    total: increment(importe),
    cantidad: increment(signo),
    porCajero: {
      [venta.cajeroId]: {
        nombre: venta.cajeroNombre,
        cantidad: increment(signo),
        total: increment(importe),
        servicios: { [venta.servicioId]: servicio },
      },
    },
    porServicio: { [venta.servicioId]: servicio },
    ultimaVentaId: ventaId,
    updatedAt: serverTimestamp(),
  };
};
