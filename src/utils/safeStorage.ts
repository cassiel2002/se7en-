// Wrapper seguro sobre localStorage.
//
// Motivo: el navegador limita localStorage a ~5 MB por sitio. Versiones
// anteriores guardaban una copia diaria de todos los clientes con una clave
// distinta por día ("clientes-todos-<fecha>") y nunca borraban las viejas,
// por lo que tras unas semanas setItem lanzaba QuotaExceededError y la app
// dejaba de funcionar en esa computadora.
//
// Reglas:
// - El cache es opcional: si falla leer o escribir, la app sigue funcionando
//   consultando Firestore.
// - Ante falta de espacio se purgan los caches de la app y se reintenta una vez.

const CACHE_PREFIXES = [
  'clientes-todos-',
  'clientes-count',
  'servicios-activos',
  'dashboard-',
];

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014);

const listKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
};

/**
 * Borra los caches diarios de clientes de días anteriores
 * (claves "clientes-todos-<fecha>" y "clientes-todos-time-<fecha>").
 */
export const purgeStaleDailyCaches = (): void => {
  try {
    const today = new Date().toDateString();
    listKeys()
      .filter(
        (key) =>
          key.startsWith('clientes-todos-') &&
          key !== `clientes-todos-${today}` &&
          key !== `clientes-todos-time-${today}`
      )
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage no disponible (modo privado estricto, etc.): nada que limpiar.
  }
};

/** Borra todos los caches de datos de la app (no toca otras preferencias). */
export const purgeAppCaches = (): void => {
  try {
    listKeys()
      .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignorar: el cache es opcional.
  }
};

export const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Lee y parsea JSON; si está corrupto lo descarta y devuelve null. */
export const safeGetJSON = <T>(key: string): T | null => {
  const raw = safeGetItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    safeRemoveItem(key);
    return null;
  }
};

/**
 * Guarda un valor. Devuelve false si no se pudo guardar (nunca lanza).
 * Si el almacenamiento está lleno, purga los caches de la app y reintenta una vez.
 */
export const safeSetItem = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) return false;
    purgeAppCaches();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      console.warn(`[cache] Sin espacio en localStorage; se omite el cache de "${key}".`);
      return false;
    }
  }
};

export const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignorar.
  }
};
