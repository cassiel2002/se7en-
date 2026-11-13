// Resúmenes diarios de ventas (colección `resumenes_ventas`, un documento por día).
//
// Objetivo: que el dashboard y el rendimiento de cajeros lean ~30 documentos por
// mes en lugar de todas las ventas. Cada venta suma (y cada eliminación resta) sus
// importes en el resumen del día, dentro del mismo batch que la venta.
//
// Activación: el documento `config/resumenes` indica desde qué día los resúmenes
// están completos. Lo crea automáticamente el dashboard del admin la primera vez,
// recalculando el mes en curso a partir de las ventas.
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { ResumenVentasDia, Venta } from './types';
import { calcularResumenes, claveDia } from './resumenesCalculo';

export { calcularResumenes, claveDia, combinarResumenes, incrementoResumen } from './resumenesCalculo';

export const RESUMENES_COLLECTION = 'resumenes_ventas';
const MARCADOR_REF = () => doc(db, 'config', 'resumenes');

export const resumenRef = (fecha: Date) => doc(db, RESUMENES_COLLECTION, claveDia(fecha));

const mapResumenDoc = (data: DocumentData): ResumenVentasDia => ({
  fecha: data.fecha,
  total: data.total || 0,
  cantidad: data.cantidad || 0,
  porCajero: data.porCajero || {},
  porServicio: data.porServicio || {},
});

/** Resúmenes entre dos fechas (inclusive). Solo admin. */
export const getResumenesRango = async (desde: Date, hasta: Date): Promise<ResumenVentasDia[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, RESUMENES_COLLECTION),
      where('fecha', '>=', claveDia(desde)),
      where('fecha', '<=', claveDia(hasta))
    )
  );
  return snapshot.docs.map((d) => mapResumenDoc(d.data()));
};

/** Día desde el cual los resúmenes están completos ("AAAA-MM-DD") o null. Solo admin. */
export const getResumenesDesde = async (): Promise<string | null> => {
  const snap = await getDoc(MARCADOR_REF());
  const desde = snap.exists() ? snap.data().desde : null;
  return typeof desde === 'string' ? desde : null;
};

/**
 * Recalcula los resúmenes de los días con ventas y marca `desde` como el primer
 * día cubierto. Sobrescribe los resúmenes existentes de esos días. Solo admin.
 *
 * Riesgo conocido: una venta registrada por un cajero mientras se ejecuta puede
 * quedar fuera del resumen de ese día. Se ejecuta una sola vez (al activar).
 */
export const inicializarResumenes = async (ventas: Venta[], desde: Date): Promise<void> => {
  const porDia = calcularResumenes(ventas);
  const batch = writeBatch(db);
  porDia.forEach((resumen, clave) => {
    batch.set(doc(db, RESUMENES_COLLECTION, clave), { ...resumen, updatedAt: serverTimestamp() });
  });
  await batch.commit();
  await setDoc(MARCADOR_REF(), { desde: claveDia(desde), actualizadoEn: serverTimestamp() });
};
