import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Download, 
  DollarSign,
  TrendingUp,
  Users,
  Scissors,
  Plus,
  Star,
  Trash2,
  Eye,
  EyeOff,
  CreditCard
} from 'lucide-react';
import { getVentas } from '../firebase/firestore';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile } from '../firebase/auth';
import { exportVentasToExcel, VentasPorCajero, TipoPeriodo } from '../utils/exportToExcel';
import { useAuth } from '../context/AuthContext';
import { usePlus } from '../hooks/usePlus';
import { useAdelantos } from '../hooks/useAdelantos';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const Reportes: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [ventasPorCajero, setVentasPorCajero] = useState<VentasPorCajero[]>([]);
  const [cajeros, setCajeros] = useState<UserProfile[]>([]);
  const [estadisticas, setEstadisticas] = useState({
    totalVentas: 0,
    totalServicios: 0,
    promedioVenta: 0,
    clientesAtendidos: 0,
    servicioMasVendido: '',
    mejorCajero: ''
  });
  const [activeFilter, setActiveFilter] = useState('este_mes');
  
  // Estados para plus manual
  const [plusManualMonto, setPlusManualMonto] = useState<Record<string, string>>({});
  const [plusManualMotivo, setPlusManualMotivo] = useState<Record<string, string>>({});
  const [mostrarDetallesPlusId, setMostrarDetallesPlusId] = useState<string | null>(null);
  
  // Hook para manejar plus - usar fecha de inicio y fin del reporte
  const fechaParaPlus = useMemo(() => {
    const [año, mes, dia] = fechaInicio.split('-').map(Number);
    return new Date(año, mes - 1, dia);
  }, [fechaInicio]);

  const fechaFinParaPlus = useMemo(() => {
    const [año, mes, dia] = fechaFin.split('-').map(Number);
    return new Date(año, mes - 1, dia);
  }, [fechaFin]);
  
  const { plusData, loading: loadingPlus, agregarPlusManual, eliminarPlusManual } = usePlus(cajeros, fechaParaPlus, fechaFinParaPlus);
  
  // Hook para manejar adelantos
  const { getAdelantosData } = useAdelantos(cajeros, fechaParaPlus, fechaFinParaPlus);
  const adelantosData = getAdelantosData();

  useEffect(() => {
    loadReportData();
  }, [fechaInicio, fechaFin]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // CORREGIR: Construir fechas respetando zona horaria local y rango completo
      const [año, mes, dia] = fechaInicio.split('-').map(Number);
      const inicio = new Date(año, mes - 1, dia, 0, 0, 0, 0); // Construir fecha local
      
      const [añoFin, mesFin, diaFin] = fechaFin.split('-').map(Number);
      const fin = new Date(añoFin, mesFin - 1, diaFin, 23, 59, 59, 999); // Construir fecha local

      console.log('🔍 Rango de fechas solicitado:', {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        inicio: inicio.toISOString(),
        fin: fin.toISOString()
      });

      // SEGURIDAD: Filtrar por cajero si no es admin
      const cajeroIdFiltro = profile?.role === 'admin' ? undefined : user?.uid;

      const [ventas, cajerosData] = await Promise.all([
        getVentas(cajeroIdFiltro, inicio, fin),
        // Cargar todos los cajeros para el manejo de plus
        getDocs(query(collection(db, 'users'), where('role', 'in', ['cashier', 'cajero', 'admin'])))
      ]);

      // Procesar cajeros
      const cajerosArray = cajerosData.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id,
      } as UserProfile));
      setCajeros(cajerosArray);

      // Filtrar ventas por fecha (doble verificación con logging)
      let ventasFiltradas = ventas.filter(venta => {
        const ventaFecha = new Date(venta.fecha);
        const estaEnRango = ventaFecha >= inicio && ventaFecha <= fin;
        
        // Log para debugging
        if (!estaEnRango) {
          console.log('❌ Venta fuera de rango:', {
            ventaId: venta.id,
            ventaFecha: ventaFecha.toISOString(),
            cliente: venta.clienteNombre,
            cajero: venta.cajeroNombre,
            precio: venta.precio
          });
        }
        
        return estaEnRango;
      });

      console.log('📊 Ventas encontradas:', {
        totalVentas: ventas.length,
        ventasEnRango: ventasFiltradas.length,
        rangoSolicitado: `${fechaInicio} a ${fechaFin}`
      });

      // SEGURIDAD ADICIONAL: Doble verificación para cajeros
      if (profile?.role === 'cashier' && user?.uid) {
        ventasFiltradas = ventasFiltradas.filter(venta => 
          venta.cajeroId === user.uid
        );
      }

      // Agrupar por cajero - Mejorar agrupación para evitar duplicados
      const ventasPorCajeroMap = ventasFiltradas.reduce((acc, venta) => {
        // Normalizar nombre del cajero para evitar duplicados por variaciones en el nombre
        const nombreNormalizado = venta.cajeroNombre.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Usar una clave compuesta: cajeroId principal, pero si ya existe un cajero con nombre similar, usar ese
        let claveAgrupacion = venta.cajeroId;
        
        // Buscar si ya existe un cajero con nombre similar
        const cajeroExistente = Object.entries(acc).find(([, datos]) => {
          const nombreExistente = datos.cajeroNombre.toLowerCase().trim().replace(/\s+/g, ' ');
          return nombreExistente === nombreNormalizado || 
                 nombreExistente.includes(nombreNormalizado) || 
                 nombreNormalizado.includes(nombreExistente);
        });
        
        if (cajeroExistente) {
          claveAgrupacion = cajeroExistente[0]; // Usar la clave del cajero existente
        }
        
        if (!acc[claveAgrupacion]) {
          acc[claveAgrupacion] = {
            cajeroNombre: venta.cajeroNombre,
            cajeroId: venta.cajeroId,
            totalVentas: 0,
            cantidadServicios: 0,
            ventas: []
          };
        }
        
        acc[claveAgrupacion].totalVentas += venta.precio;
        acc[claveAgrupacion].cantidadServicios += 1;
        acc[claveAgrupacion].ventas.push(venta);
        
        return acc;
      }, {} as Record<string, VentasPorCajero>);

      const ventasPorCajeroArray = Object.values(ventasPorCajeroMap);
      setVentasPorCajero(ventasPorCajeroArray);

      // Calcular estadísticas
      const totalVentas = ventasFiltradas.reduce((sum, v) => sum + v.precio, 0);
      const totalServicios = ventasFiltradas.length;
      const clientesUnicos = new Set(ventasFiltradas.map(v => v.clienteId)).size;

      // Servicio más vendido
      const serviciosCount = ventasFiltradas.reduce((acc, venta) => {
        acc[venta.servicioNombre] = (acc[venta.servicioNombre] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const servicioMasVendido = Object.entries(serviciosCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

      // Mejor cajero
      const mejorCajeroData = ventasPorCajeroArray
        .sort((a, b) => b.totalVentas - a.totalVentas)[0];
      
      const mejorCajero = mejorCajeroData 
        ? (mejorCajeroData.cajeroId === user?.uid 
           ? profile?.name || mejorCajeroData.cajeroNombre 
           : mejorCajeroData.cajeroNombre)
        : 'N/A';

      setEstadisticas({
        totalVentas,
        totalServicios,
        promedioVenta: totalServicios > 0 ? totalVentas / totalServicios : 0,
        clientesAtendidos: clientesUnicos,
        servicioMasVendido,
        mejorCajero
      });

    } catch (error) {
      console.error('Error cargando reportes:', error);
      toast.error('Error cargando reportes');
    } finally {
      setLoading(false);
    }
  };

  // Función para determinar el tipo de período basado en el filtro activo y las fechas
  const determinarTipoPeriodo = (): TipoPeriodo => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diferenciaDias = differenceInDays(fin, inicio);
    
    // Determinar según el filtro activo primero
    if (activeFilter === 'hoy') {
      return 'dia';
    } else if (activeFilter === 'esta_semana') {
      return 'semana';
    } else if (activeFilter === 'este_mes' || activeFilter === 'mes_anterior') {
      return 'mes';
    }
    
    // Si no hay filtro activo, determinar por diferencia de días
    if (diferenciaDias <= 1) {
      return 'dia';
    } else if (diferenciaDias <= 7) {
      return 'semana';
    } else {
      return 'mes';
    }
  };

  const handleExportExcel = async () => {
    if (ventasPorCajero.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    try {
      const tipoPeriodo = determinarTipoPeriodo();
      
      // Construir fechas de la misma manera que en loadReportData
      const [año, mes, dia] = fechaInicio.split('-').map(Number);
      const inicio = new Date(año, mes - 1, dia, 0, 0, 0, 0);
      
      const [añoFin, mesFin, diaFin] = fechaFin.split('-').map(Number);
      const fin = new Date(añoFin, mesFin - 1, diaFin, 23, 59, 59, 999);
      
      console.log('📤 Exportando Excel con fechas:', {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        inicio: inicio.toISOString(),
        fin: fin.toISOString()
      });
      
      // Enriquecer datos de cajeros con plus y adelantos para el Excel
      const ventasConPlusYAdelantos = ventasPorCajero.map(cajero => {
        const plusCajero = plusData.find(p => p.cajeroId === cajero.cajeroId);
        const adelantoCajero = adelantosData.find(a => a.cajeroId === cajero.cajeroId);
        return {
          ...cajero,
          plusAutomatico: plusCajero?.plusAutomatico || 0,
          plusManual: plusCajero?.plusManual || 0,
          totalPlus: plusCajero?.totalPlus || 0,
          adelantosPendientes: adelantoCajero?.totalPendiente || 0,
          adelantosDescontados: adelantoCajero?.totalDescontado || 0,
          totalAdelantos: adelantoCajero?.totalPendiente || 0
        };
      });
      
      await exportVentasToExcel(
        ventasConPlusYAdelantos,
        inicio,
        fin,
        tipoPeriodo
      );
      
      // Mensaje personalizado según el tipo de período
      const mensajeTipo = tipoPeriodo === 'dia' ? 'diario' : 
                         tipoPeriodo === 'semana' ? 'semanal' : 'mensual';
      toast.success(`Reporte ${mensajeTipo} exportado exitosamente`);
    } catch (error) {
      console.error('Error exportando reporte:', error);
      toast.error('Error exportando reporte');
    }
  };

  const setRangoMes = (mesesAtras: number = 0) => {
    const fecha = subMonths(new Date(), mesesAtras);
    // Replicar la lógica exacta de setRangoSemana() - usando startOfMonth/endOfMonth
    setFechaInicio(format(startOfMonth(fecha), 'yyyy-MM-dd'));
    setFechaFin(format(endOfMonth(fecha), 'yyyy-MM-dd'));
    setActiveFilter(mesesAtras === 0 ? 'este_mes' : 'mes_anterior');
  };

  const setRangoHoy = () => {
    const hoy = new Date();
    // Replicar la lógica exacta de setRangoSemana() - usando startOfDay/endOfDay
    setFechaInicio(format(startOfDay(hoy), 'yyyy-MM-dd'));
    setFechaFin(format(endOfDay(hoy), 'yyyy-MM-dd'));
    setActiveFilter('hoy');
  };

  const setRangoSemana = () => {
    const hoy = new Date();
    // Esta función ya funciona correctamente - mantener como referencia
    setFechaInicio(format(startOfWeek(hoy, { locale: es }), 'yyyy-MM-dd'));
    setFechaFin(format(endOfWeek(hoy, { locale: es }), 'yyyy-MM-dd'));
    setActiveFilter('esta_semana');
  };

  // Función para agregar plus manual
  const handleAgregarPlusManual = async (cajeroId: string, cajeroNombre: string) => {
    const monto = parseFloat(plusManualMonto[cajeroId] || '0');
    const motivo = plusManualMotivo[cajeroId] || '';

    if (monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (!profile?.name || !user?.uid) {
      toast.error('Usuario no válido');
      return;
    }

    const success = await agregarPlusManual(
      cajeroId,
      cajeroNombre,
      monto,
      motivo,
      user.uid,
      profile.name
    );

    if (success) {
      toast.success(`Plus de $${monto.toLocaleString()} agregado a ${cajeroNombre}`);
      // Limpiar inputs
      setPlusManualMonto(prev => ({ ...prev, [cajeroId]: '' }));
      setPlusManualMotivo(prev => ({ ...prev, [cajeroId]: '' }));
    } else {
      toast.error('Error agregando plus manual');
    }
  };

  // Función para eliminar plus manual
  const handleEliminarPlusManual = async (plusId: string, cajeroNombre: string, monto: number) => {
    if (!confirm(`¿Estás seguro de eliminar el plus de $${monto.toLocaleString()} para ${cajeroNombre}?`)) {
      return;
    }

    const success = await eliminarPlusManual(plusId);

    if (success) {
      toast.success(`Plus eliminado correctamente`);
    } else {
      toast.error('Error eliminando plus manual');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <BarChart3 className="mr-3 text-red-600" size={32} />
            Reportes y Estadísticas
          </h1>
          <p className="text-gray-400 mt-2">
            Analiza el rendimiento del negocio
          </p>
        </div>
        
        <button
          onClick={handleExportExcel}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Download size={20} />
          <span>Exportar Excel</span>
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Período de Análisis</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
          
          <div className="md:col-span-2 flex space-x-2">
            <button
              onClick={() => setRangoHoy()}
              className={activeFilter === 'hoy' ? "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors" : "bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"}
            >
              Hoy
            </button>
            <button
              onClick={() => setRangoSemana()}
              className={activeFilter === 'esta_semana' ? "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors" : "bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setRangoMes(0)}
              className={activeFilter === 'este_mes' ? "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors" : "bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"}
            >
              Este Mes
            </button>
            <button
              onClick={() => setRangoMes(1)}
              className={activeFilter === 'mes_anterior' ? "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors" : "bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"}
            >
              Mes Anterior
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Ventas</p>
              <p className="text-2xl font-bold text-green-400">${estadisticas.totalVentas.toLocaleString()}</p>
            </div>
            <DollarSign className="text-green-400" size={24} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Servicios Vendidos</p>
              <p className="text-2xl font-bold text-blue-400">{estadisticas.totalServicios}</p>
            </div>
            <Scissors className="text-blue-400" size={24} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Promedio por Venta</p>
              <p className="text-2xl font-bold text-purple-400">${estadisticas.promedioVenta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <TrendingUp className="text-purple-400" size={24} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Clientes Atendidos</p>
              <p className="text-2xl font-bold text-orange-400">{estadisticas.clientesAtendidos}</p>
            </div>
            <Users className="text-orange-400" size={24} />
          </div>
        </motion.div>
      </div>

      {/* Ventas por Cajero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <BarChart3 className="mr-2 text-red-600" size={20} />
          Ventas por Cajero ({format(new Date(fechaInicio), 'MM/yyyy', { locale: es })} - {format(new Date(fechaFin), 'MM/yyyy', { locale: es })})
        </h3>
        
        {ventasPorCajero.length > 0 ? (
          <div className="table-responsive">
            <table className="w-full text-left text-gray-400 min-w-full">
              <thead className="text-xs sm:text-sm text-gray-200 uppercase bg-gray-800">
                <tr>
                  <th scope="col" className="px-3 sm:px-6 py-3 rounded-l-lg">Cajero</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-center">Servicios</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right rounded-r-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventasPorCajero.sort((a, b) => b.totalVentas - a.totalVentas).map(cajero => (
                  <tr key={cajero.cajeroId} className="bg-gray-900 border-b border-gray-800">
                    <th scope="row" className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-white">
                      <span className="block truncate max-w-[120px] sm:max-w-none">
                        {cajero.cajeroId === user?.uid ? profile?.name || cajero.cajeroNombre : cajero.cajeroNombre}
                      </span>
                    </th>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-sm sm:text-base">{cajero.cantidadServicios}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-green-400 text-sm sm:text-base">
                      <span className="whitespace-nowrap">${cajero.totalVentas.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-white bg-gray-800">
                  <th scope="row" className="px-3 sm:px-6 py-3 rounded-l-lg text-sm sm:text-base">Total General</th>
                  <td className="px-3 sm:px-6 py-3 text-center text-sm sm:text-base">{estadisticas.totalServicios}</td>
                  <td className="px-3 sm:px-6 py-3 text-right rounded-r-lg text-sm sm:text-base">
                    <span className="whitespace-nowrap">${estadisticas.totalVentas.toLocaleString()}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <p>No hay ventas registradas para el período seleccionado.</p>
          </div>
        )}
      </motion.div>

      {/* Comisiones 50-50 - Solo visible para Admin */}
      {profile?.role === 'admin' && ventasPorCajero.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-6 border border-yellow-600/30"
        >
                     <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center">
             <DollarSign className="mr-2 text-yellow-400" size={20} />
             Comisiones Admin-Cajeros
           </h3>
          
          {/* Resumen General de Comisiones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(() => {
              // Calcular correctamente las comisiones
              const adminCajero = ventasPorCajero.find(c => 
                c.cajeroNombre.toLowerCase().includes('admin') || 
                c.cajeroId === user?.uid && profile?.role === 'admin'
              );
              const otrosCajeros = ventasPorCajero.filter(c => 
                !c.cajeroNombre.toLowerCase().includes('admin') && 
                !(c.cajeroId === user?.uid && profile?.role === 'admin')
              );
              
              const ventasAdmin = adminCajero?.totalVentas || 0;
              const ventasOtrosCajeros = otrosCajeros.reduce((sum, c) => sum + c.totalVentas, 0);
              
              // Admin se queda con: 100% de lo suyo + 50% de los demás
              const totalParaAdmin = ventasAdmin + (ventasOtrosCajeros * 0.5);
              // Cajeros reciben: 50% de lo que facturan
              const totalParaCajeros = ventasOtrosCajeros * 0.5;
              
              return (
                <>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Total Facturado</p>
                    <p className="text-xl font-bold text-white">${estadisticas.totalVentas.toLocaleString()}</p>
                  </div>
                  <div className="bg-yellow-900/30 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Para Admin</p>
                    <p className="text-xl font-bold text-yellow-400">${totalParaAdmin.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">100% suyo + 50% cajeros</p>
                  </div>
                  <div className="bg-green-900/30 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">Para Cajeros</p>
                    <p className="text-xl font-bold text-green-400">${totalParaCajeros.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">50% de lo facturado</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Desglose por Cajero */}
          <div className="table-responsive">
            <table className="w-full text-left text-gray-400 min-w-[700px]">
              <thead className="text-xs sm:text-sm text-gray-200 uppercase bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-3 sm:px-6 py-3 rounded-l-lg">Cajero</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right">Facturado</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right">Admin (50%)</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right">Cajero (50%)</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right">Plus</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right">Adelantos</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-right rounded-r-lg">Total Cajero</th>
                </tr>
              </thead>
                             <tbody>
                 {ventasPorCajero.sort((a, b) => b.totalVentas - a.totalVentas).map(cajero => {
                   // Determinar si es admin
                   const esAdmin = cajero.cajeroNombre.toLowerCase().includes('admin') || 
                                  (cajero.cajeroId === user?.uid && profile?.role === 'admin');
                   
                   // Obtener datos del plus para este cajero
                   const datosPlusCajero = plusData.find(p => p.cajeroId === cajero.cajeroId);
                   const plusTotal = datosPlusCajero?.totalPlus || 0;
                   
                   // Obtener datos de adelantos para este cajero
                   const datosAdelantoCajero = adelantosData.find(a => a.cajeroId === cajero.cajeroId);
                   const adelantosPendientes = datosAdelantoCajero?.totalPendiente || 0;
                   
                   let comisionAdmin, pagoCajero, totalParaCajero;
                   
                   if (esAdmin) {
                     // Admin se queda con todo lo suyo
                     comisionAdmin = cajero.totalVentas;
                     pagoCajero = 0;
                     totalParaCajero = 0;
                   } else {
                     // Cajeros: 50% para admin, 50% para cajero + plus - adelantos pendientes
                     comisionAdmin = cajero.totalVentas * 0.5;
                     pagoCajero = cajero.totalVentas * 0.5;
                     totalParaCajero = pagoCajero + plusTotal - adelantosPendientes;
                   }
                   
                   return (
                     <tr key={`comision-${cajero.cajeroId}`} className="bg-gray-900/50 border-b border-gray-700">
                       <th scope="row" className="px-6 py-4 font-medium text-white whitespace-nowrap">
                         {cajero.cajeroId === user?.uid ? profile?.name || cajero.cajeroNombre : cajero.cajeroNombre}
                         {esAdmin && <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ADMIN</span>}
                         {(datosPlusCajero?.plusAutomatico || 0) > 0 && <span className="ml-2 text-xs bg-purple-600 px-2 py-1 rounded">ENCARGADO</span>}
                       </th>
                       <td className="px-6 py-4 text-right font-semibold text-gray-300">
                         ${cajero.totalVentas.toLocaleString()}
                       </td>
                       <td className="px-6 py-4 text-right font-bold text-yellow-400">
                         ${comisionAdmin.toLocaleString()}
                       </td>
                       <td className="px-6 py-4 text-right font-bold text-green-400">
                         ${pagoCajero.toLocaleString()}
                       </td>
                       <td className="px-6 py-4 text-right font-bold text-purple-400">
                         {plusTotal > 0 ? `$${plusTotal.toLocaleString()}` : '-'}
                       </td>
                       <td className="px-6 py-4 text-right font-bold text-orange-400">
                         {adelantosPendientes > 0 ? `-$${adelantosPendientes.toLocaleString()}` : '-'}
                       </td>
                       <td className="px-6 py-4 text-right font-bold text-blue-400">
                         {esAdmin ? '-' : `$${totalParaCajero.toLocaleString()}`}
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
                             <tfoot>
                 {(() => {
                   // Calcular totales correctos
                   const adminCajero = ventasPorCajero.find(c => 
                     c.cajeroNombre.toLowerCase().includes('admin') || 
                     c.cajeroId === user?.uid && profile?.role === 'admin'
                   );
                   const otrosCajeros = ventasPorCajero.filter(c => 
                     !c.cajeroNombre.toLowerCase().includes('admin') && 
                     !(c.cajeroId === user?.uid && profile?.role === 'admin')
                   );
                   
                   const ventasAdmin = adminCajero?.totalVentas || 0;
                   const ventasOtrosCajeros = otrosCajeros.reduce((sum, c) => sum + c.totalVentas, 0);
                   
                   const totalParaAdmin = ventasAdmin + (ventasOtrosCajeros * 0.5);
                   const totalParaCajeros = ventasOtrosCajeros * 0.5;
                   
                   // Calcular totales de plus
                   const totalPlus = plusData.reduce((sum, p) => sum + p.totalPlus, 0);
                   // Calcular totales de adelantos pendientes
                   const totalAdelantosPendientes = adelantosData.reduce((sum, a) => sum + a.totalPendiente, 0);
                   const totalFinalParaCajeros = totalParaCajeros + totalPlus - totalAdelantosPendientes;
                   
                   return (
                     <tr className="font-semibold text-white bg-gray-800/70">
                       <th scope="row" className="px-6 py-3 rounded-l-lg">TOTALES</th>
                       <td className="px-6 py-3 text-right">${estadisticas.totalVentas.toLocaleString()}</td>
                       <td className="px-6 py-3 text-right text-yellow-400">${totalParaAdmin.toLocaleString()}</td>
                       <td className="px-6 py-3 text-right text-green-400">${totalParaCajeros.toLocaleString()}</td>
                       <td className="px-6 py-3 text-right text-purple-400">${totalPlus.toLocaleString()}</td>
                       <td className="px-6 py-3 text-right text-orange-400">-${totalAdelantosPendientes.toLocaleString()}</td>
                       <td className="px-6 py-3 text-right text-blue-400 rounded-r-lg">${totalFinalParaCajeros.toLocaleString()}</td>
                     </tr>
                   );
                 })()}
               </tfoot>
            </table>
          </div>

                                <div className="mt-4 space-y-3">
             <div className="p-3 bg-gray-800/30 rounded-lg">
               <p className="text-sm text-gray-400 text-center">
                 💡 <strong>Sistema de Comisiones:</strong> El admin se queda con el 100% de sus ventas + 50% de las ventas de los cajeros. Los cajeros reciben el 50% de lo que facturan + plus adicional - adelantos pendientes.
               </p>
             </div>
             
             {/* Mensaje específico para cajeros encargados */}
             {(() => {
               const cajerosConPlus = plusData.filter(p => p.totalPlus > 0);
               if (cajerosConPlus.length === 0) return null;
               
               return (
                 <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-600/30">
                   <p className="text-sm text-purple-300 font-semibold mb-2">⭐ Pagos adicionales por plus:</p>
                   <div className="space-y-1">
                     {cajerosConPlus.map(cajero => {
                       const cajeroVenta = ventasPorCajero.find(c => c.cajeroId === cajero.cajeroId);
                       const comision = cajeroVenta ? cajeroVenta.totalVentas * 0.5 : 0;
                       const adelantoCajero = adelantosData.find(a => a.cajeroId === cajero.cajeroId);
                       const adelantosPendientes = adelantoCajero?.totalPendiente || 0;
                       const totalFinal = comision + cajero.totalPlus - adelantosPendientes;
                       
                       return (
                         <p key={cajero.cajeroId} className="text-sm text-gray-300">
                           • <strong>{cajero.cajeroNombre}</strong> le toca un total de <strong className="text-blue-400">${totalFinal.toLocaleString()}</strong>
                           <span className="text-gray-400 text-xs ml-2">
                             (${comision.toLocaleString()} comisión + ${cajero.totalPlus.toLocaleString()} plus{adelantosPendientes > 0 ? ` - $${adelantosPendientes.toLocaleString()} adelantos` : ''})
                           </span>
                         </p>
                       );
                     })}
                   </div>
                 </div>
               );
             })()}
             
             {/* Mensaje específico para adelantos pendientes */}
             {(() => {
               const cajerosConAdelantos = adelantosData.filter(a => a.totalPendiente > 0);
               if (cajerosConAdelantos.length === 0) return null;
               
               return (
                 <div className="p-3 bg-orange-900/20 rounded-lg border border-orange-600/30">
                   <p className="text-sm text-orange-300 font-semibold mb-2">⚠️ Adelantos pendientes por descontar:</p>
                   <div className="space-y-1">
                     {cajerosConAdelantos.map(cajero => {
                       return (
                         <p key={cajero.cajeroId} className="text-sm text-gray-300">
                           • <strong>{cajero.cajeroNombre}</strong> tiene <strong className="text-orange-400">${cajero.totalPendiente.toLocaleString()}</strong> pendientes de descontar
                           <span className="text-gray-400 text-xs ml-2">
                             ({cajero.adelantosPendientes.length} adelanto{cajero.adelantosPendientes.length !== 1 ? 's' : ''})
                           </span>
                         </p>
                       );
                     })}
                   </div>
                 </div>
               );
             })()}
           </div>
         </motion.div>
       )}

      {/* Gestión de Plus para Cajeros - Solo visible para Admin */}
      {profile?.role === 'admin' && ventasPorCajero.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-600/30"
        >
          <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center">
            <Star className="mr-2 text-purple-400" size={20} />
            Gestión de Plus para Cajeros
          </h3>
          
          {/* Resumen de Plus */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Total Plus Automático</p>
              <p className="text-xl font-bold text-purple-400">
                ${plusData.reduce((sum, p) => sum + p.plusAutomatico, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-900/30 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Total Plus Manual</p>
              <p className="text-xl font-bold text-blue-400">
                ${plusData.reduce((sum, p) => sum + p.plusManual, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-green-900/30 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Total Plus General</p>
              <p className="text-xl font-bold text-green-400">
                ${plusData.reduce((sum, p) => sum + p.totalPlus, 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Tabla de Plus por Cajero */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-gray-400">
              <thead className="text-xs text-gray-200 uppercase bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 rounded-l-lg">Cajero</th>
                  <th scope="col" className="px-6 py-3 text-center">Plus Automático</th>
                  <th scope="col" className="px-6 py-3 text-center">Plus Manual Hoy</th>
                  <th scope="col" className="px-6 py-3 text-center">Agregar Plus</th>
                  <th scope="col" className="px-6 py-3 text-right rounded-r-lg">Total Plus</th>
                </tr>
              </thead>
              <tbody>
                {plusData.map(plus => {
                  const cajero = ventasPorCajero.find(c => c.cajeroId === plus.cajeroId);
                  if (!cajero) return null;
                  
                  const esAdmin = cajero.cajeroNombre.toLowerCase().includes('admin') || 
                                 (cajero.cajeroId === user?.uid && profile?.role === 'admin');
                  
                  return (
                    <tr key={`plus-${plus.cajeroId}`} className="bg-gray-900/50 border-b border-gray-700">
                      <th scope="row" className="px-6 py-4 font-medium text-white whitespace-nowrap">
                        {cajero.cajeroId === user?.uid ? profile?.name || cajero.cajeroNombre : cajero.cajeroNombre}
                        {esAdmin && <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ADMIN</span>}
                      </th>
                      <td className="px-6 py-4 text-center">
                        <span className="text-purple-400 font-semibold">
                          ${plus.plusAutomatico.toLocaleString()}
                        </span>
                        {plus.plusAutomatico > 0 && <span className="ml-1 text-xs text-purple-300">(Encargado)</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-blue-400 font-semibold">
                            ${plus.plusManual.toLocaleString()}
                          </span>
                          {plus.plusManualesDetalle.length > 0 && (
                            <button
                              onClick={() => setMostrarDetallesPlusId(
                                mostrarDetallesPlusId === plus.cajeroId ? null : plus.cajeroId
                              )}
                              className="text-gray-400 hover:text-blue-400 transition-colors"
                              title="Ver detalles"
                            >
                              {mostrarDetallesPlusId === plus.cajeroId ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                        </div>
                        
                        {/* Mostrar detalles de plus manual si está expandido */}
                        {mostrarDetallesPlusId === plus.cajeroId && plus.plusManualesDetalle.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs">
                            {plus.plusManualesDetalle.map(plusDetalle => (
                              <div key={plusDetalle.id} className="flex items-center justify-between py-1">
                                <div>
                                  <span className="text-blue-300">${plusDetalle.monto.toLocaleString()}</span>
                                  {plusDetalle.motivo && (
                                    <span className="text-gray-400 ml-2">({plusDetalle.motivo})</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleEliminarPlusManual(
                                    plusDetalle.id!,
                                    plus.cajeroNombre,
                                    plusDetalle.monto
                                  )}
                                  className="text-red-400 hover:text-red-300 transition-colors ml-2"
                                  title="Eliminar plus"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!esAdmin && (
                          <div className="flex space-x-2">
                            <input
                              type="number"
                              placeholder="Monto"
                              value={plusManualMonto[plus.cajeroId] || ''}
                              onChange={(e) => setPlusManualMonto(prev => ({ ...prev, [plus.cajeroId]: e.target.value }))}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Motivo"
                              value={plusManualMotivo[plus.cajeroId] || ''}
                              onChange={(e) => setPlusManualMotivo(prev => ({ ...prev, [plus.cajeroId]: e.target.value }))}
                              className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            />
                            <button
                              onClick={() => handleAgregarPlusManual(plus.cajeroId, plus.cajeroNombre)}
                              disabled={loadingPlus}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center"
                            >
                              <Plus size={14} className="mr-1" />
                              Agregar
                            </button>
                          </div>
                        )}
                        {esAdmin && (
                          <span className="text-gray-500 text-sm">Solo para cajeros</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-green-400">
                          ${plus.totalPlus.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
            <p className="text-sm text-gray-400 text-center">
              ⭐ <strong>Plus Automático:</strong> Para cajeros marcados como encargados. <strong>Plus Manual:</strong> Incentivos específicos del día. 
              Haz clic en el ícono del ojo para ver y eliminar plus manuales individuales.
            </p>
          </div>
        </motion.div>
      )}

      {/* Gestión de Adelantos para Cajeros - Solo visible para Admin */}
      {profile?.role === 'admin' && ventasPorCajero.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-orange-900/20 to-red-900/20 rounded-xl p-6 border border-orange-600/30"
        >
          <h3 className="text-lg font-semibold text-orange-400 mb-4 flex items-center">
            <CreditCard className="mr-2 text-orange-400" size={20} />
            Gestión de Adelantos para Cajeros
          </h3>
          
          {/* Resumen de Adelantos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-900/30 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Total Adelantos Pendientes</p>
              <p className="text-xl font-bold text-orange-400">
                ${adelantosData.reduce((sum, a) => sum + a.totalPendiente, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-green-900/30 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Total Adelantos Descontados</p>
              <p className="text-xl font-bold text-green-400">
                ${adelantosData.reduce((sum, a) => sum + a.totalDescontado, 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Tabla de Adelantos por Cajero */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-gray-400">
              <thead className="text-xs text-gray-200 uppercase bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 rounded-l-lg">Cajero</th>
                  <th scope="col" className="px-6 py-3 text-center">Adelantos Pendientes</th>
                  <th scope="col" className="px-6 py-3 text-center">Adelantos Descontados</th>
                  <th scope="col" className="px-6 py-3 text-right rounded-r-lg">Impacto en Pago</th>
                </tr>
              </thead>
              <tbody>
                {adelantosData.map(adelanto => {
                  const cajero = ventasPorCajero.find(c => c.cajeroId === adelanto.cajeroId);
                  if (!cajero) return null;
                  
                  const esAdmin = cajero.cajeroNombre.toLowerCase().includes('admin') || 
                                 (cajero.cajeroId === user?.uid && profile?.role === 'admin');
                  
                  // No mostrar admin en la tabla de adelantos
                  if (esAdmin) return null;
                  
                  return (
                    <tr key={`adelanto-${adelanto.cajeroId}`} className="bg-gray-900/50 border-b border-gray-700">
                      <th scope="row" className="px-6 py-4 font-medium text-white whitespace-nowrap">
                        {cajero.cajeroId === user?.uid ? profile?.name || cajero.cajeroNombre : cajero.cajeroNombre}
                      </th>
                      <td className="px-6 py-4 text-center">
                        <span className="text-orange-400 font-semibold">
                          ${adelanto.totalPendiente.toLocaleString()}
                        </span>
                        {adelanto.adelantosPendientes.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {adelanto.adelantosPendientes.length} adelanto{adelanto.adelantosPendientes.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-green-400 font-semibold">
                          ${adelanto.totalDescontado.toLocaleString()}
                        </span>
                        {adelanto.adelantosDescontados.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {adelanto.adelantosDescontados.length} descontado{adelanto.adelantosDescontados.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-red-400">
                          -${adelanto.totalPendiente.toLocaleString()}
                        </span>
                        <div className="text-xs text-gray-400 mt-1">
                          Del pago final
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
            <p className="text-sm text-gray-400 text-center">
              ⚠️ <strong>Adelantos Pendientes:</strong> Se descuentan automáticamente del pago final. <strong>Adelantos Descontados:</strong> Ya fueron aplicados en pagos anteriores.
              Los adelantos se gestionan desde la página específica de Adelantos.
            </p>
          </div>
        </motion.div>
      )}

      {/* Mejor Servicio y Mejor Cajero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Scissors className="mr-2 text-red-600" size={20} />
            Servicio Más Vendido
          </h3>
          <p className="text-2xl font-bold text-red-600">{estadisticas.servicioMasVendido}</p>
          <p className="text-gray-400 text-sm mt-1">Período seleccionado</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Users className="mr-2 text-blue-500" size={20} />
            Cajero con Más Ventas
          </h3>
          <p className="text-2xl font-bold text-blue-500">{estadisticas.mejorCajero}</p>
          <p className="text-gray-400 text-sm mt-1">Período seleccionado</p>
        </motion.div>
      </div>
    </div>
  );
};