import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  purgeAppCaches,
  purgeStaleDailyCaches,
  safeGetJSON,
  safeSetItem,
} from '../../src/utils/safeStorage';

const quotaError = () => new DOMException('exceeded the quota', 'QuotaExceededError');

describe('safeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('borra los caches diarios de clientes de otros días y conserva el de hoy', () => {
    const hoy = new Date().toDateString();
    localStorage.setItem('clientes-todos-Mon Jan 01 2024', '[]');
    localStorage.setItem('clientes-todos-time-Mon Jan 01 2024', '1');
    localStorage.setItem(`clientes-todos-${hoy}`, '[1]');
    localStorage.setItem(`clientes-todos-time-${hoy}`, '2');
    localStorage.setItem('pwa-prompt-dismissed', '3');

    purgeStaleDailyCaches();

    expect(Object.keys(localStorage).sort()).toEqual(
      [`clientes-todos-${hoy}`, `clientes-todos-time-${hoy}`, 'pwa-prompt-dismissed'].sort()
    );
  });

  it('purgeAppCaches no toca claves ajenas a los caches de datos', () => {
    localStorage.setItem('servicios-activos', '[]');
    localStorage.setItem('dashboard-uid1', '{}');
    localStorage.setItem('pwa-prompt-dismissed', '1');
    purgeAppCaches();
    expect(Object.keys(localStorage)).toEqual(['pwa-prompt-dismissed']);
  });

  it('ante QuotaExceededError purga los caches y reintenta una vez', () => {
    localStorage.setItem('clientes-todos-viejo', 'x');
    const original = Storage.prototype.setItem;
    let llamadas = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      llamadas++;
      if (llamadas === 1) throw quotaError();
      return original.call(this, k, v);
    });

    expect(safeSetItem('servicios-activos', '[]')).toBe(true);
    expect(llamadas).toBe(2);
    expect(localStorage.getItem('clientes-todos-viejo')).toBeNull();
    expect(localStorage.getItem('servicios-activos')).toBe('[]');
  });

  it('si sigue sin espacio devuelve false y no lanza', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeSetItem('k', 'v')).toBe(false);
  });

  it('safeGetJSON descarta JSON corrupto', () => {
    localStorage.setItem('k', '{no-es-json');
    expect(safeGetJSON('k')).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });
});
