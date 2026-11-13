// Punto de entrada de la capa de datos de Firestore.
// Cada dominio vive en su propio módulo; este archivo solo los re-exporta para que
// las pantallas importen desde un único lugar.
export * from './types';
export * from './clientes';
export * from './servicios';
export * from './ventas';
export * from './turnos';
export * from './personal';
export * from './puntos';
export * from './resumenes';
export * from './busqueda';
export * from './dashboard';
