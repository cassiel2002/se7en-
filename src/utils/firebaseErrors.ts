// Traduce errores de Firebase / del navegador a mensajes claros para el usuario.
// Se distingue explícitamente la cuota de Firestore (plan Spark) del almacenamiento
// local lleno del navegador, porque ambos dicen "quota" en inglés.

const getCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';

const getMessage = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : '';

export const getFriendlyErrorMessage = (error: unknown): string => {
  const code = getCode(error);
  const message = getMessage(error);

  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'El almacenamiento del navegador está lleno. Recargá la página; si persiste, borrá los datos del sitio.';
  }
  if (code === 'resource-exhausted' || code === 'firestore/resource-exhausted') {
    return 'Se alcanzó el límite diario gratuito de la base de datos. Se restablece durante la madrugada.';
  }
  if (code === 'unavailable' || code === 'auth/network-request-failed') {
    return 'Error de conexión. Verificá tu internet e intentá de nuevo.';
  }
  if (code === 'permission-denied') {
    return 'Tu usuario no tiene permisos para esta operación. Contactá al administrador.';
  }
  if (code === 'app/profile-not-found') {
    return 'Tu usuario no tiene un perfil configurado. Contactá al administrador.';
  }
  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Credenciales incorrectas. Verificá tu email y contraseña.';
  }
  if (code === 'auth/invalid-email') return 'El formato del email no es válido.';
  if (code === 'auth/user-disabled') return 'Esta cuenta ha sido deshabilitada.';
  if (code === 'auth/too-many-requests') {
    return 'Demasiados intentos fallidos desde este dispositivo. Esperá unos minutos e intentá de nuevo.';
  }

  return message ? `Ocurrió un error: ${message}` : 'Ocurrió un error inesperado. Intentá de nuevo.';
};
