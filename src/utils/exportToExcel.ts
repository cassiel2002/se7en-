import { crearLibro, agregarHoja, descargarLibro, Celda } from './excelWriter';
import { Venta } from '../firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export interface VentasPorCajero {
  cajeroNombre: string;
  cajeroId: string;
  totalVentas: number;
  cantidadServicios: number;
  ventas: Venta[];
  // Plus data
  plusAutomatico?: number;
  plusManual?: number;
  totalPlus?: number;
  // Adelantos data
  adelantosPendientes?: number;
  adelantosDescontados?: number;
  totalAdelantos?: number;
}

export type TipoPeriodo = 'dia' | 'semana' | 'mes';

// Helper para formato de método de pago
const formatMetodoPago = (metodoPago: string | undefined): string => {
  if (!metodoPago) return 'Efectivo'; // Por defecto efectivo para ventas anteriores
  return metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia';
};

export const exportVentasToExcel = async (
  ventasPorCajero: VentasPorCajero[],
  fechaInicio: Date,
  fechaFin: Date,
  tipoPeriodo: TipoPeriodo = 'mes'
) => {
  console.log('📊 Exportando Excel con datos:', {
    fechaInicio: fechaInicio.toISOString(),
    fechaFin: fechaFin.toISOString(),
    tipoPeriodo,
    totalCajeros: ventasPorCajero.length,
    ventasPorCajero: ventasPorCajero.map(c => ({
      cajero: c.cajeroNombre,
      totalVentas: c.totalVentas,
      cantidadServicios: c.cantidadServicios,
      plusAutomatico: c.plusAutomatico,
      plusManual: c.plusManual,
      totalPlus: c.totalPlus
    }))
  });

  const wb = crearLibro();
  
  // Título y período
  const esMismoDia = isSameDay(fechaInicio, fechaFin);
  const formatoFecha = esMismoDia 
    ? format(fechaInicio, 'dd/MM/yyyy', { locale: es })
    : `${format(fechaInicio, 'dd/MM/yyyy', { locale: es })} - ${format(fechaFin, 'dd/MM/yyyy', { locale: es })}`;

  const titulo = tipoPeriodo === 'dia' ? 'REPORTE DIARIO' : 
                tipoPeriodo === 'semana' ? 'REPORTE SEMANAL' : 'REPORTE MENSUAL';

  // Datos generales
  const todasLasVentas = ventasPorCajero.flatMap(cajero => cajero.ventas);
  const totalGeneral = todasLasVentas.reduce((sum, v) => sum + v.precio, 0);
  const totalServicios = ventasPorCajero.reduce((sum, c) => sum + c.cantidadServicios, 0);

  // Separar admin de cajeros
  const adminCajero = ventasPorCajero.find(c => c.cajeroNombre.toLowerCase().includes('admin'));
  const cajeros = ventasPorCajero.filter(c => !c.cajeroNombre.toLowerCase().includes('admin'));

  // ==================== HOJA 1: RESUMEN EJECUTIVO ====================
  const resumenData: Celda[][] = [
    [`${titulo} - BARBERÍA SE7EN`],
    [`Período: ${formatoFecha}`],
    [''],
    ['📊 RESUMEN EJECUTIVO'],
    [''],
    ['Total Facturado:', `$${totalGeneral.toLocaleString()}`],
    ['Total Servicios:', totalServicios.toString()],
    [''],
    ['💰 DISTRIBUCIÓN DE INGRESOS'],
    ['']
  ];

  // Calcular distribución de ingresos
  const totalCajeros = cajeros.reduce((sum, c) => sum + c.totalVentas, 0);
  const comisionCajeros = totalCajeros * 0.5;
  const totalPlusCalculado = cajeros.reduce((sum, c) => sum + (c.plusAutomatico || 0) + (c.plusManual || 0), 0);
  const totalAdelantosCalculado = cajeros.reduce((sum, c) => sum + (c.adelantosPendientes || 0), 0);
  const totalParaCajeros = comisionCajeros + totalPlusCalculado - totalAdelantosCalculado;

  if (adminCajero) {
    const paraAdmin = adminCajero.totalVentas + comisionCajeros;
    resumenData.push(['Admin (100% propio + 50% cajeros):', `$${paraAdmin.toLocaleString()}`]);
  }
  
  if (totalPlusCalculado > 0 || totalAdelantosCalculado > 0) {
    resumenData.push(['Cajeros (50% comisión):', `$${comisionCajeros.toLocaleString()}`]);
    if (totalPlusCalculado > 0) {
      resumenData.push(['Cajeros (plus adicional):', `$${totalPlusCalculado.toLocaleString()}`]);
    }
    if (totalAdelantosCalculado > 0) {
      resumenData.push(['Cajeros (adelantos pendientes):', `-$${totalAdelantosCalculado.toLocaleString()}`]);
    }
    resumenData.push(['TOTAL PARA CAJEROS:', `$${totalParaCajeros.toLocaleString()}`]);
  } else {
    resumenData.push(['Cajeros (50% comisión):', `$${comisionCajeros.toLocaleString()}`]);
  }
  resumenData.push(['']);
  resumenData.push(['👥 RENDIMIENTO POR CAJERO']);
  resumenData.push(['Cajero', 'Servicios', 'Facturado']);
  
  ventasPorCajero.forEach(cajero => {
    resumenData.push([
      cajero.cajeroNombre,
      cajero.cantidadServicios.toString(),
      `$${cajero.totalVentas.toLocaleString()}`
    ]);
  });

  const wsResumenAnchos = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
  agregarHoja(wb, 'Resumen Ejecutivo', resumenData, wsResumenAnchos.map((c) => c.wch));

  // ==================== HOJA 2: PAGOS A CAJEROS ====================
  // Verificar si hay plus o adelantos para decidir estructura
  const hayPlusAutomatico = cajeros.some(c => (c.plusAutomatico || 0) > 0);
  const hayPlusManual = cajeros.some(c => (c.plusManual || 0) > 0);
  const hayAlgunPlus = hayPlusAutomatico || hayPlusManual;
  const hayAdelantos = cajeros.some(c => (c.adelantosPendientes || 0) > 0);

  const pagosData: Celda[][] = [
    [`💵 PAGOS A CAJEROS - ${formatoFecha}`],
    [''],
    ['Sistema: Cajeros reciben 50% + Plus - Adelantos Pendientes'],
    ['']
  ];

  // Headers dinámicos según si hay plus y/o adelantos
  const headers = ['Cajero', 'Facturado', 'Comisión 50%'];
  if (hayAlgunPlus) headers.push('Plus Total');
  if (hayAdelantos) headers.push('Adelantos');
  headers.push('PAGO TOTAL');
  
  pagosData.push(headers);
  
  pagosData.push(['']);

  // Filas de cajeros
  cajeros.forEach(cajero => {
    const comision = cajero.totalVentas * 0.5;
    const plusTotal = (cajero.plusAutomatico || 0) + (cajero.plusManual || 0);
    const adelantosPendientes = cajero.adelantosPendientes || 0;
    const pagoTotal = comision + plusTotal - adelantosPendientes;
    
    const fila = [
      cajero.cajeroNombre,
      `$${cajero.totalVentas.toLocaleString()}`,
      `$${comision.toLocaleString()}`
    ];
    
    if (hayAlgunPlus) {
      fila.push(plusTotal > 0 ? `$${plusTotal.toLocaleString()}` : '-');
    }
    
    if (hayAdelantos) {
      fila.push(adelantosPendientes > 0 ? `-$${adelantosPendientes.toLocaleString()}` : '-');
    }
    
    fila.push(`$${pagoTotal.toLocaleString()}`);
    pagosData.push(fila);
  });

  // Totales
  pagosData.push(['']);
  const totalFacturado = cajeros.reduce((sum, c) => sum + c.totalVentas, 0);
  const totalComision = cajeros.reduce((sum, c) => sum + c.totalVentas * 0.5, 0);
  const totalPlus = cajeros.reduce((sum, c) => sum + (c.plusAutomatico || 0) + (c.plusManual || 0), 0);
  const totalAdelantos = cajeros.reduce((sum, c) => sum + (c.adelantosPendientes || 0), 0);
  const totalPagoFinal = totalComision + totalPlus - totalAdelantos;

  const filaTotales = [
    'TOTALES:', 
    `$${totalFacturado.toLocaleString()}`,
    `$${totalComision.toLocaleString()}`
  ];
  
  if (hayAlgunPlus) {
    filaTotales.push(totalPlus > 0 ? `$${totalPlus.toLocaleString()}` : '-');
  }
  
  if (hayAdelantos) {
    filaTotales.push(totalAdelantos > 0 ? `-$${totalAdelantos.toLocaleString()}` : '-');
  }
  
  filaTotales.push(`$${totalPagoFinal.toLocaleString()}`);
  pagosData.push(filaTotales);

  // Solo agregar desglose detallado si hay plus Y si es útil mostrarlo
  if (hayPlusAutomatico && hayPlusManual) {
    pagosData.push(['']);
    pagosData.push(['📋 DESGLOSE DETALLADO DE PLUS']);
    pagosData.push(['Cajero', 'Plus Encargado', 'Plus Manual', 'Total Plus']);
    
    cajeros.forEach(cajero => {
      const plusAuto = cajero.plusAutomatico || 0;
      const plusMan = cajero.plusManual || 0;
      
      if (plusAuto > 0 || plusMan > 0) {
        pagosData.push([
          cajero.cajeroNombre,
          plusAuto > 0 ? `$${plusAuto.toLocaleString()}` : '-',
          plusMan > 0 ? `$${plusMan.toLocaleString()}` : '-',
          `$${(plusAuto + plusMan).toLocaleString()}`
        ]);
      }
    });
  }

  // Ajustar ancho de columnas dinámicamente según columnas presentes
  const columns = [{ wch: 20 }, { wch: 15 }, { wch: 15 }]; // Cajero, Facturado, Comisión
  if (hayAlgunPlus) columns.push({ wch: 15 }); // Plus
  if (hayAdelantos) columns.push({ wch: 15 }); // Adelantos
  columns.push({ wch: 18 }); // Pago Total
  
  const wsPagosAnchos = columns;
  agregarHoja(wb, 'Pagos a Cajeros', pagosData, wsPagosAnchos.map((c) => c.wch));

  // ==================== HOJA 3: DETALLE DE VENTAS ====================
  const ventasData = [
    [`📋 DETALLE DE VENTAS - ${formatoFecha}`],
    [''],
    ['Fecha', 'Cajero', 'Cliente', 'Servicio', 'Precio', 'Método Pago'],
    [''],
    ...todasLasVentas
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .map(venta => [
        format(venta.fecha, 'dd/MM/yyyy HH:mm', { locale: es }),
        venta.cajeroNombre,
        venta.clienteNombre,
        venta.servicioNombre,
        `$${venta.precio.toLocaleString()}`,
        formatMetodoPago(venta.metodoPago)
      ])
  ];

  const wsVentasAnchos = [
    { wch: 18 }, // Fecha
    { wch: 18 }, // Cajero
    { wch: 20 }, // Cliente
    { wch: 25 }, // Servicio
    { wch: 12 }, // Precio
    { wch: 15 }  // Método
  ];
  agregarHoja(wb, 'Detalle de Ventas', ventasData, wsVentasAnchos.map((c) => c.wch));

  // ==================== HOJA 4: ANÁLISIS POR MÉTODO DE PAGO ====================
  const efectivo = todasLasVentas.filter(v => formatMetodoPago(v.metodoPago) === 'Efectivo');
  const transferencia = todasLasVentas.filter(v => formatMetodoPago(v.metodoPago) === 'Transferencia');
  
  const metodoPagoData: Celda[][] = [
    [`💳 ANÁLISIS POR MÉTODO DE PAGO - ${formatoFecha}`],
    [''],
    ['RESUMEN GENERAL'],
    ['Método', 'Cantidad', 'Total'],
    ['Efectivo', efectivo.length.toString(), `$${efectivo.reduce((sum, v) => sum + v.precio, 0).toLocaleString()}`],
    ['Transferencia', transferencia.length.toString(), `$${transferencia.reduce((sum, v) => sum + v.precio, 0).toLocaleString()}`],
    ['TOTAL', todasLasVentas.length.toString(), `$${totalGeneral.toLocaleString()}`],
    [''],
    ['DETALLE POR CAJERO'],
    ['Cajero', 'Efectivo', 'Transferencia', 'Total']
  ];

  ventasPorCajero.forEach(cajero => {
    const efectivoCajero = cajero.ventas.filter(v => formatMetodoPago(v.metodoPago) === 'Efectivo').reduce((sum, v) => sum + v.precio, 0);
    const transferenciaCajero = cajero.ventas.filter(v => formatMetodoPago(v.metodoPago) === 'Transferencia').reduce((sum, v) => sum + v.precio, 0);
    
    metodoPagoData.push([
      cajero.cajeroNombre,
      efectivoCajero > 0 ? `$${efectivoCajero.toLocaleString()}` : '-',
      transferenciaCajero > 0 ? `$${transferenciaCajero.toLocaleString()}` : '-',
      `$${cajero.totalVentas.toLocaleString()}`
    ]);
  });

  const wsMetodoPagoAnchos = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  agregarHoja(wb, 'Métodos de Pago', metodoPagoData, wsMetodoPagoAnchos.map((c) => c.wch));

  // ==================== HOJAS INDIVIDUALES POR CAJERO ====================
  ventasPorCajero.forEach(cajero => {
    if (cajero.ventas.length === 0) return;

    const cajeroData: Celda[][] = [
      [`👤 ${cajero.cajeroNombre.toUpperCase()}`],
      [`Período: ${formatoFecha}`],
      [''],
      ['📊 RESUMEN'],
      [`Total Servicios: ${cajero.cantidadServicios}`],
      [`Total Facturado: $${cajero.totalVentas.toLocaleString()}`]
    ];

    // Agregar información de pago solo si no es admin
    if (!cajero.cajeroNombre.toLowerCase().includes('admin')) {
      const comision = cajero.totalVentas * 0.5;
      const plusAuto = cajero.plusAutomatico || 0;
      const plusMan = cajero.plusManual || 0;
      const pagoTotal = comision + plusAuto + plusMan;

      cajeroData.push([`Comisión 50%: $${comision.toLocaleString()}`]);
      
      // Solo mostrar plus automático si existe
      if (plusAuto > 0) {
        cajeroData.push([`Plus Encargado: $${plusAuto.toLocaleString()}`]);
      }
      
      // Solo mostrar plus manual si realmente se ha agregado
      if (plusMan > 0) {
        cajeroData.push([`Plus Manual: $${plusMan.toLocaleString()}`]);
      }
      
      cajeroData.push([`PAGO TOTAL: $${pagoTotal.toLocaleString()}`]);
    }

    cajeroData.push(['']);
    cajeroData.push(['📋 DETALLE DE VENTAS']);
    cajeroData.push(['Fecha', 'Cliente', 'Servicio', 'Precio', 'Método']);
    
    // Agregar ventas
    cajero.ventas
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .forEach(venta => {
        cajeroData.push([
          format(venta.fecha, 'dd/MM/yyyy HH:mm', { locale: es }),
          venta.clienteNombre,
          venta.servicioNombre,
          `$${venta.precio.toLocaleString()}`,
          formatMetodoPago(venta.metodoPago)
        ]);
      });

      const wsCajeroAnchos = [
      { wch: 18 }, // Fecha
      { wch: 20 }, // Cliente
      { wch: 25 }, // Servicio
      { wch: 12 }, // Precio
      { wch: 15 }  // Método
    ];

    // Limpiar nombre para usar como nombre de hoja
    const nombreHoja = cajero.cajeroNombre.replace(/[^\w\s]/gi, '').substring(0, 31);
    agregarHoja(wb, nombreHoja, cajeroData, wsCajeroAnchos.map((c) => c.wch));
  });

  // Descargar archivo
  const nombreArchivo = `Se7en_${titulo.replace(/\s+/g, '_')}_${format(fechaInicio, 'dd-MM-yyyy', { locale: es })}.xlsx`;
  await descargarLibro(wb, nombreArchivo);
};