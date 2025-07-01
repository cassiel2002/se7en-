import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  Scissors,
  Clock
} from 'lucide-react';
import { getVentas, getClientes, getTurnos } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  ventasHoy: number;
  ventasMes: number;
  clientesTotal: number;
  turnosHoy: number;
  servicioMasVendido: string;
  cajeroTop: string;
}

export const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    ventasMes: 0,
    clientesTotal: 0,
    turnosHoy: 0,
    servicioMasVendido: '-',
    cajeroTop: '-'
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, [profile, user]);

  const loadDashboardData = async () => {
    if (!profile || !user) return;
    
    try {
      const hoy = new Date();
      const inicioMes = startOfMonth(hoy);
      const finMes = endOfMonth(hoy);
      const inicioHoy = startOfDay(hoy);
      const finHoy = endOfDay(hoy);

      // Obtener datos
      const cajeroIdFiltro = profile.role === 'admin' ? undefined : user.uid;

      const [ventas, clientes, turnos] = await Promise.all([
        getVentas(cajeroIdFiltro),
        getClientes(),
        getTurnos(hoy, cajeroIdFiltro) // Aplicar filtro de cajero también a turnos
      ]);

      // Calcular estadísticas
      const ventasHoy = ventas
        .filter(v => v.fecha >= inicioHoy && v.fecha <= finHoy)
        .reduce((sum, v) => sum + v.precio, 0);

      const ventasMes = ventas
        .filter(v => v.fecha >= inicioMes && v.fecha <= finMes)
        .reduce((sum, v) => sum + v.precio, 0);

      // Servicio más vendido
      const serviciosCount = ventas
        .filter(v => v.fecha >= inicioMes && v.fecha <= finMes)
        .reduce((acc, venta) => {
          acc[venta.servicioNombre] = (acc[venta.servicioNombre] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const servicioMasVendido = Object.entries(serviciosCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || '-';

      // Cajero top (solo para admin)
      let cajeroTop = '-';
      if (profile?.role === 'admin') {
        const cajerosVentas = ventas
          .filter(v => v.fecha >= inicioMes && v.fecha <= finMes)
          .reduce((acc, venta) => {
            acc[venta.cajeroNombre] = (acc[venta.cajeroNombre] || 0) + venta.precio;
            return acc;
          }, {} as Record<string, number>);

        cajeroTop = Object.entries(cajerosVentas)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || '-';
      }

      setStats({
        ventasHoy,
        ventasMes,
        clientesTotal: clientes.length,
        turnosHoy: turnos.filter(t => t.estado === 'pendiente').length,
        servicioMasVendido,
        cajeroTop
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Ventas Hoy',
      value: `$${stats.ventasHoy.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-600',
      change: '+12%'
    },
    {
      title: 'Ventas del Mes',
      value: `$${stats.ventasMes.toLocaleString()}`,
      icon: TrendingUp,
      color: 'bg-blue-600',
      change: '+8%'
    },
    {
      title: 'Total Clientes',
      value: stats.clientesTotal.toString(),
      icon: Users,
      color: 'bg-purple-600',
      change: '+5%'
    },
    {
      title: 'Turnos Hoy',
      value: stats.turnosHoy.toString(),
      icon: Calendar,
      color: 'bg-orange-600',
      change: `${stats.turnosHoy} pendientes`
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          <span className="hidden sm:inline">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </span>
          <span className="sm:hidden">
            {format(new Date(), "dd/MM/yyyy", { locale: es })}
          </span>
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800 touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs sm:text-sm truncate">{card.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-white mt-1 truncate">{card.value}</p>
                <p className="text-green-500 text-xs sm:text-sm mt-1 truncate">{card.change}</p>
              </div>
              <div className={`${card.color} p-2 sm:p-3 rounded-lg flex-shrink-0 ml-4`}>
                <card.icon className="text-white" size={20} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800"
        >
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center">
            <Scissors className="mr-2 text-red-600" size={18} />
            <span className="truncate">Servicio Más Popular</span>
          </h3>
          <p className="text-xl sm:text-2xl font-bold text-red-600 truncate">{stats.servicioMasVendido}</p>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Este mes</p>
        </motion.div>

        {profile?.role === 'admin' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800"
          >
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2 text-green-600" size={20} />
              Cajero Top
            </h3>
            <p className="text-2xl font-bold text-green-600">{stats.cajeroTop}</p>
            <p className="text-gray-400 text-sm mt-1">Mayor facturación</p>
          </motion.div>
        )}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <h3 className="text-xl font-semibold text-white mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate(profile?.role === 'admin' ? '/agenda' : '/cajero/agenda')}
            className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Calendar size={20} />
            <span>Nuevo Turno</span>
          </button>
          <button 
            onClick={() => navigate(profile?.role === 'admin' ? '/clientes' : '/cajero/clientes')}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Users size={20} />
            <span>Nuevo Cliente</span>
          </button>
          <button 
            onClick={() => navigate(profile?.role === 'admin' ? '/ventas' : '/cajero/ventas')}
            className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <DollarSign size={20} />
            <span>Registrar Venta</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};