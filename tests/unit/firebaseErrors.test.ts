import { describe, expect, it } from 'vitest';
import { errorConCodigo, getFriendlyErrorMessage } from '../../src/utils/firebaseErrors';

describe('getFriendlyErrorMessage', () => {
  it('distingue la cuota de Firestore del almacenamiento del navegador', () => {
    expect(getFriendlyErrorMessage({ code: 'resource-exhausted' })).toMatch(/límite diario/);
    expect(getFriendlyErrorMessage(new DOMException('x', 'QuotaExceededError'))).toMatch(/almacenamiento del navegador/);
  });

  it('credenciales incorrectas solo para errores de credenciales', () => {
    expect(getFriendlyErrorMessage({ code: 'auth/invalid-credential' })).toMatch(/Credenciales incorrectas/);
    expect(getFriendlyErrorMessage({ code: 'unavailable' })).toMatch(/conexión/);
    expect(getFriendlyErrorMessage({ code: 'permission-denied' })).toMatch(/permisos/);
    expect(getFriendlyErrorMessage({ code: 'auth/too-many-requests' })).toMatch(/Demasiados intentos/);
  });

  it('errorConCodigo conserva el código original', () => {
    const e = errorConCodigo('Error creando venta', { code: 'permission-denied' });
    expect(e.message).toBe('Error creando venta');
    expect(e.code).toBe('permission-denied');
    expect(getFriendlyErrorMessage(e)).toMatch(/permisos/);
  });
});
