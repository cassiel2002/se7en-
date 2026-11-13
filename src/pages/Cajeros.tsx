import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Mail, 
  User,
  Calendar,
  Shield,
  UserCheck,
  Trash2,
  TrendingUp,
  DollarSign,
  Award,
  BarChart3
} from 'lucide-react';
import { UserProfile } from '../firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { deleteCajeroProfile, getVentas, Venta } from '../firebase/firestore';
import toast from 'react-hot-toast';
import { startOfMonth, endOfMonth } from 'date-fns';

interface RendimientoCajero {
  cajeroId: string;
  cajeroNombre: string;
  servicios: { [servicio: string]: number };
  totalServicios: number;
  totalVentas: number;
}

export const Cajeros: React.FC = () => {
  const [cajeros, setCajeros] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rendimiento, setRendimiento] = useState<RendimientoCajero[]>([]);
  const [loadingRendimiento, setLoadingRendimiento] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    loadCajeros();
    loadRendimiento();
  }, []);

  const loadCajeros = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'cashier'));
      const querySnapshot = await getDocs(q);
      
      const cajerosData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as UserProfile));
      
      console.log('➡️ Cajeros cargados de Firestore:', cajerosData);
      setCajeros(cajerosData);
    } catch (error) {
      console.error('Error loading cajeros:', error);
      toast.error('Error cargando cajeros');
    } finally {
      setLoading(false);
    }
  };

  const loadRendimiento = async () => {
    setLoadingRendimiento(true);
    try {
      const fechaInicio = startOfMonth(new Date());
      const fechaFin = endOfMonth(new Date());
      
      console.log('📊 Cargando rendimiento del mes:', { fechaInicio, fechaFin });
      
      // Obtener todas las ventas del mes actual
      const ventas = await getVentas(undefined, fechaInicio, fechaFin, 1000); // Límite alto para cálculos
      console.log('📈 Ventas del mes:', ventas);
      
      // Agrupar ventas por cajero
      const rendimientoPorCajero: { [cajeroId: string]: RendimientoCajero } = {};
      
      ventas.forEach(venta => {
        if (!rendimientoPorCajero[venta.cajeroId]) {
          rendimientoPorCajero[venta.cajeroId] = {
            cajeroId: venta.cajeroId,
            cajeroNombre: venta.cajeroNombre,
            servicios: {},
            totalServicios: 0,
            totalVentas: 0
          };
        }
        
        const rendimientoCajero = rendimientoPorCajero[venta.cajeroId];
        
        // Contar servicios por tipo
        if (!rendimientoCajero.servicios[venta.servicioNombre]) {
          rendimientoCajero.servicios[venta.servicioNombre] = 0;
        }
        rendimientoCajero.servicios[venta.servicioNombre]++;
        
        // Incrementar totales
        rendimientoCajero.totalServicios++;
        rendimientoCajero.totalVentas += venta.precio;
      });
      
      const rendimientoArray = Object.values(rendimientoPorCajero);
      console.log('📊 Rendimiento calculado:', rendimientoArray);
      
      setRendimiento(rendimientoArray);
    } catch (error) {
      console.error('Error loading rendimiento:', error);
      toast.error('Error cargando rendimiento');
    } finally {
      setLoadingRendimiento(false);
    }
  };

  const handleDeleteCajero = async (uid: string) => {
    if (!profile || profile.role !== 'admin') {
      toast.error('No tienes permiso para eliminar cajeros.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este cajero? Esto eliminará su perfil, pero no su cuenta de autenticación de Firebase si existe.')) {
      try {
        await deleteCajeroProfile(uid);
        toast.success('Cajero eliminado exitosamente');
        loadCajeros();
      } catch (error) {
        console.error('Error deleting cajero:', error);
        toast.error('Error eliminando cajero');
      }
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
            <Users className="mr-3 text-red-600" size={32} />
            Gestión de Cajeros
          </h1>
          <p className="text-gray-400 mt-2">
            Visualiza y administra los cajeros del sistema
          </p>
        </div>
        
        <div className="bg-gray-800 px-4 py-2 rounded-lg">
          <span className="text-gray-400 text-sm">Total: </span>
          <span className="text-white font-bold">{cajeros.length} cajeros</span>
        </div>
      </div>

      {/* Lista de Cajeros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cajeros.map((cajero, index) => (
          <motion.div
            key={`cajero-${cajero.uid}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-red-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                <User className="text-white" size={20} />
              </div>
              <div className="flex items-center space-x-1">
                <UserCheck className="text-green-500" size={16} />
                <span className="text-green-500 text-sm font-medium">Activo</span>
              </div>
              {profile?.role === 'admin' && (
                <button
                  key={`delete-btn-${cajero.uid}`}
                  onClick={() => handleDeleteCajero(cajero.uid)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              <div key={`header-${cajero.uid}`}>
                <h3 className="text-xl font-semibold text-white">{cajero.name}</h3>
                <div className="flex items-center text-gray-400 text-sm mt-1">
                  <Shield className="mr-1" size={14} />
                  <span className="capitalize">{cajero.role}</span>
                </div>
              </div>
              
              <div key={`email-${cajero.uid}`} className="flex items-center text-gray-300">
                <Mail className="mr-2 text-gray-500" size={16} />
                <span className="text-sm">{cajero.email}</span>
              </div>
              
              <div key={`date-${cajero.uid}`} className="flex items-center text-gray-300">
                <Calendar className="mr-2 text-gray-500" size={16} />
                <span className="text-sm">
                  Desde {cajero.createdAt.toLocaleDateString('es-ES')}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {cajeros.length === 0 && (
        <motion.div
          key="no-cajeros-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Users className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            No hay cajeros registrados
          </h3>
          <p className="text-gray-500">
            Los cajeros se registran directamente en la base de datos de Firebase Auth
          </p>
        </motion.div>
      )}

      {/* Sección de Rendimiento por Cajero */}
      {rendimiento.length > 0 && (
        <motion.div
          key="rendimiento-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <TrendingUp className="mr-2 text-green-500" size={24} />
              Rendimiento del Mes Actual
            </h3>
            {loadingRendimiento && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rendimiento
              .sort((a, b) => b.totalVentas - a.totalVentas)
              .map((cajeroRendimiento, index) => (
                <motion.div
                  key={`rendimiento-${cajeroRendimiento.cajeroId}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-green-500 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mr-3">
                        <User className="text-white" size={18} />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-sm">
                          {cajeroRendimiento.cajeroNombre}
                        </h4>
                        {index === 0 && (
                          <div className="flex items-center mt-1">
                            <Award className="text-yellow-500 mr-1" size={14} />
                            <span className="text-yellow-500 text-xs font-medium">Top Performer</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {index < 3 && (
                      <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <DollarSign className="text-green-400 mr-2" size={16} />
                        <span className="text-gray-400 text-sm">Total Ventas</span>
                      </div>
                      <span className="text-green-400 font-bold">
                        ${cajeroRendimiento.totalVentas.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <BarChart3 className="text-blue-400 mr-2" size={16} />
                        <span className="text-gray-400 text-sm">Servicios</span>
                      </div>
                      <span className="text-blue-400 font-bold">
                        {cajeroRendimiento.totalServicios}
                      </span>
                    </div>
                    
                    {/* Promedio por servicio */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Promedio</span>
                      <span className="text-gray-300 font-medium">
                        ${cajeroRendimiento.totalServicios > 0 ? 
                          Math.round(cajeroRendimiento.totalVentas / cajeroRendimiento.totalServicios) : 0}
                      </span>
                    </div>
                    
                    {/* Top 3 servicios más vendidos */}
                    {Object.keys(cajeroRendimiento.servicios).length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <p className="text-gray-400 text-xs mb-2">Servicios más vendidos:</p>
                        <div className="space-y-1">
                          {Object.entries(cajeroRendimiento.servicios)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 3)
                            .map(([servicio, cantidad]) => (
                              <div key={servicio} className="flex justify-between text-xs">
                                <span className="text-gray-300 truncate mr-2">{servicio}</span>
                                <span className="text-white font-medium">{cantidad}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
          
          {/* Resumen general */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">
                  ${rendimiento.reduce((total, r) => total + r.totalVentas, 0).toLocaleString()}
                </div>
                <div className="text-gray-400 text-sm">Ventas Totales</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">
                  {rendimiento.reduce((total, r) => total + r.totalServicios, 0)}
                </div>
                <div className="text-gray-400 text-sm">Servicios Totales</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">
                  {rendimiento.length}
                </div>
                <div className="text-gray-400 text-sm">Cajeros Activos</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">
                  ${rendimiento.length > 0 ? 
                    Math.round(rendimiento.reduce((total, r) => total + r.totalVentas, 0) / rendimiento.length).toLocaleString() : 0}
                </div>
                <div className="text-gray-400 text-sm">Promedio por Cajero</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Información adicional */}
      <motion.div
        key="informacion-sistema"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Shield className="mr-2 text-blue-500" size={20} />
          Información del Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div key="info-left" className="space-y-2">
            <p className="text-gray-400">
              <span className="font-medium text-white">Cajeros activos:</span> {cajeros.length}
            </p>
            <p className="text-gray-400">
              <span className="font-medium text-white">Último registro:</span>{' '}
              {cajeros.length > 0 
                ? cajeros.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
                    .createdAt.toLocaleDateString('es-ES')
                : 'N/A'
              }
            </p>
          </div>
          <div key="info-right" className="space-y-2">
            <p className="text-gray-400">
              <span className="font-medium text-white">Gestión:</span> Base de datos
            </p>
            <p className="text-gray-400">
              <span className="font-medium text-white">Estado:</span> Solo lectura
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};