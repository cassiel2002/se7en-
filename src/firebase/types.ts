// Tipos de dominio compartidos por la capa de datos y las pantallas.

export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  email?: string;
  dni?: string;
  visitas: number;
  ultimaVisita?: Date;
  puntos: number; // Puntos acumulados
  puntosCanjeados: number; // Puntos ya utilizados
  createdAt: Date;
  updatedAt?: Date; // Lo escribe el servidor; se usa para la sincronización incremental
  ultimaVentaId?: string;  // Venta que sumó el último punto (lo validan las reglas)
  ultimoCanjeId?: string;  // Canje que restó puntos por última vez (lo validan las reglas)
}

/** Datos para crear un cliente: puntos y fechas los asigna el sistema. */
export type NuevoCliente = Omit<Cliente, 'id' | 'createdAt' | 'updatedAt' | 'puntos' | 'puntosCanjeados' | 'visitas'> & {
  visitas?: number;
};

export interface Servicio {
  id?: string;
  nombre: string;
  precio: number;
  duracion: number; // en minutos
  descripcion?: string;
  activo: boolean;
  createdAt: Date;
}

export interface Venta {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  servicioId: string;
  servicioNombre: string;
  precio: number;
  metodoPago: 'efectivo' | 'transferencia';
  cajeroId: string;
  cajeroNombre: string;
  cajeroEmail: string;
  fecha: Date;
  createdAt: Date;
}

export interface Turno {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  servicioId: string;
  servicioNombre: string;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  hora: string;
  estado: 'pendiente' | 'completado' | 'cancelado';
  createdAt: Date;
}

export interface PlusManual {
  id?: string;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date; // Solo fecha (sin hora)
  monto: number;
  motivo?: string;
  adminId: string;
  adminNombre: string;
  createdAt: Date;
}

export interface Adelanto {
  id?: string;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  monto: number;
  concepto: string; // Por qué se da el adelanto (materiales, gastos, etc.)
  estado: 'pendiente' | 'descontado' | 'pagado'; // Estado del adelanto
  adminId: string;
  adminNombre: string;
  fechaDescuento?: Date; // Cuándo se descontó del pago
  observaciones?: string;
  createdAt: Date;
}

// Nuevas interfaces para el sistema de puntos
export interface Premio {
  id?: string;
  nombre: string;
  descripcion: string;
  puntosRequeridos: number;
  activo: boolean;
  tipo: 'descuento' | 'servicio_gratis' | 'producto'; // Tipo de premio
  valor?: number; // Para descuentos (ej: 50 para 50% off)
  servicioId?: string; // Para servicios gratis específicos
  createdAt: Date;
}

export interface CanjeoPuntos {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  premioId: string;
  premioNombre: string;
  puntosUtilizados: number;
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  estado: 'canjeado' | 'utilizado'; // canjeado = disponible para usar, utilizado = ya usado
  ventaId?: string; // Si se aplicó en una venta específica
  createdAt: Date;
}

export interface MovimientoPuntos {
  id?: string;
  clienteId: string;
  clienteNombre: string;
  tipo: 'ganados' | 'canjeados' | 'ajuste'; // Tipo de movimiento
  puntos: number; // Positivo para ganados, negativo para canjeados
  motivo: string; // Descripción del movimiento
  ventaId?: string; // Si fue por una venta
  canjeId?: string; // Si fue por un canje
  cajeroId: string;
  cajeroNombre: string;
  fecha: Date;
  createdAt: Date;
}

/** Totales acumulados de un servicio. */
export interface TotalesServicio {
  nombre: string;
  cantidad: number;
  total: number;
}

/** Totales acumulados de un cajero. */
export interface TotalesCajero {
  nombre: string;
  cantidad: number;
  total: number;
  servicios: Record<string, TotalesServicio>; // por servicioId
}

/**
 * Resumen de ventas de un día (colección `resumenes_ventas`, id = "AAAA-MM-DD").
 * Se actualiza con incrementos en el mismo batch que crea o elimina la venta.
 */
export interface ResumenVentasDia {
  fecha: string;
  total: number;
  cantidad: number;
  porCajero: Record<string, TotalesCajero>;   // por cajeroId
  porServicio: Record<string, TotalesServicio>; // por servicioId
  ultimaVentaId?: string;
}
