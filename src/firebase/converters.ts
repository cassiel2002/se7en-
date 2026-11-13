// Conversión de datos de Firestore y utilidades de texto puras (sin acceso a red).
import { Timestamp } from 'firebase/firestore';

/** Convierte Timestamp | Date | string | number a Date; devuelve undefined si no es válido. */
export const toDateOrUndefined = (value: unknown): Date | undefined => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

/** Minúsculas y sin acentos, para búsquedas ("María" coincide con "maria"). */
export const normalizarTexto = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Quita las propiedades undefined (Firestore las rechaza). */
export const sinUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
