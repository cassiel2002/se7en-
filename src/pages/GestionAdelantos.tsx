import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Plus, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  Check,
  Trash2
} from 'lucide-react';
import { UserProfile } from '../firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useAdelantos } from '../hooks/useAdelantos';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const GestionAdelantos: React.FC = () => {
  const { user, profile } = useAuth();
  const [cajeros, setCajeros] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Estados para el formulario de nuevo adelanto
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    cajeroId: '',
    monto: '',
    concepto: '',
    observaciones: ''
  });

  // Calcular fechas para el hook
  const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : undefined;
  const fechaFinDate = fechaFin ? new Date(fechaFin) : undefined;
  const hasDateFilter = fechaInicio || fechaFin;
  
  const { 
    adelantos, 
    crearAdelanto, 
    marcarComoDescontado, 
    eliminarAdelanto 
  } = useAdelantos(cajeros, fechaInicioDate, fechaFinDate, hasDateFilter ? undefined : 3);

  useEffect(() => {
    loadCajeros();
  }, []);

  const loadCajeros = async () => {
    try {
      let q;
      if (profile?.role === 'admin') {
        q = query(collection(db, 'users'), where('role', '==', 'cashier'));
      } else {
        q = query(collection(db, 'users'), where('uid', '==', user?.uid));
      }
      
      const querySnapshot = await getDocs(q);
      const cajerosData = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as UserProfile));
      
      setCajeros(cajerosData);
      
      if (profile?.role === 'cashier' && user?.uid) {
        setFormData(prev => ({ ...prev, cajeroId: user.uid }));
      }
    } catch (error) {
      console.error('Error loading cajeros:', error);
      toast.error('Error cargando cajeros');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.cajeroId || !formData.monto || !formData.concepto) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    const cajero = cajeros.find(c => c.uid === formData.cajeroId);
    if (!cajero) {
      toast.error('Cajero no encontrado');
      return;
    }

    try {
      await crearAdelanto({
        cajeroId: formData.cajeroId,
        cajeroNombre: cajero.name,
        fecha: new Date(),
        monto: parseFloat(formData.monto),
        concepto: formData.concepto,
        estado: 'pendiente',
        observaciones: formData.observaciones || undefined
      });

      setFormData({
        cajeroId: profile?.role === 'cashier' ? user?.uid || '' : '',
        monto: '',
        concepto: '',
        observaciones: ''
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating adelanto:', error);
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
            <CreditCard className="mr-3 text-orange-600" size={32} />
            Gestión de Adelantos
          </h1>
          <p className="text-gray-400 mt-2">
            {profile?.role === 'admin' 
              ? 'Administra adelantos para los cajeros'
              : 'Solicita y visualiza tus adelantos pendientes'
            }
          </p>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus size={20} />
          <span>Nuevo Adelanto</span>
        </button>
      </div>

      {/* Filtros por Fecha */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="text-gray-400" size={16} />
            <span className="text-gray-300 text-sm font-medium">Filtrar por fecha:</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center space-x-2">
              <label className="text-gray-400 text-sm">Desde:</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-gray-400 text-sm">Hasta:</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
            
            {(fechaInicio || fechaFin) && (
              <button
                onClick={() => {
                  setFechaInicio('');
                  setFechaFin('');
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
          
          <div className="text-xs text-gray-500">
            {hasDateFilter ? 'Mostrando todos los adelantos del período' : 'Mostrando últimos 3 por cajero'}
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-600/30">
        <h3 className="text-orange-400 font-semibold mb-2">ℹ️ Información Importante</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>Adelanto:</strong> Dinero que se te da antes del pago de comisiones</li>
          <li>• <strong>Pendiente:</strong> Adelanto aún no descontado del pago</li>
          <li>• <strong>Descontado:</strong> Ya se aplicó en el cálculo de pagos</li>
          <li>• <strong>Sin filtros:</strong> Solo se muestran los últimos 3 adelantos por cajero</li>
        </ul>
      </div>

      {/* Lista de adelantos */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <DollarSign className="mr-2 text-green-400" size={20} />
            {profile?.role === 'admin' ? 'Todos los Adelantos' : 'Mis Adelantos'} ({adelantos.length})
          </h3>
        </div>

        <div className="p-6">
          {adelantos.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No hay adelantos registrados</p>
          ) : (
            <div className="space-y-4">
              {adelantos.map(adelanto => (
                <motion.div
                  key={adelanto.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border-l-4 ${
                    adelanto.estado === 'pendiente'
                      ? 'bg-orange-900/20 border-orange-500'
                      : 'bg-green-900/20 border-green-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h4 className="font-semibold text-white">
                          {profile?.role === 'admin' ? adelanto.cajeroNombre : 'Mi adelanto'}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          adelanto.estado === 'pendiente'
                            ? 'bg-orange-600 text-orange-100'
                            : 'bg-green-600 text-green-100'
                        }`}>
                          {adelanto.estado.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center text-gray-300">
                          <DollarSign className="mr-2 text-green-400" size={16} />
                          <span className="font-bold text-lg">${adelanto.monto.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center text-gray-300">
                          <Calendar className="mr-2 text-gray-500" size={16} />
                          <span>{format(adelanto.fecha, 'dd/MM/yyyy', { locale: es })}</span>
                        </div>
                        <div className="flex items-center text-gray-300">
                          <AlertCircle className="mr-2 text-gray-500" size={16} />
                          <span>{adelanto.concepto}</span>
                        </div>
                      </div>

                      {adelanto.observaciones && (
                        <div className="mt-2 text-sm text-gray-400">
                          <strong>Observaciones:</strong> {adelanto.observaciones}
                        </div>
                      )}

                      {adelanto.fechaDescuento && (
                        <div className="mt-2 text-sm text-green-400">
                          <strong>Descontado el:</strong> {format(adelanto.fechaDescuento, 'dd/MM/yyyy', { locale: es })}
                        </div>
                      )}
                    </div>

                    {profile?.role === 'admin' && (
                      <div className="flex items-center space-x-2">
                        {adelanto.estado === 'pendiente' && (
                          <button
                            onClick={() => marcarComoDescontado(adelanto.id!)}
                            className="text-green-400 hover:text-green-300 transition-colors"
                            title="Marcar como descontado"
                          >
                            <Check size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => eliminarAdelanto(adelanto.id!)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Eliminar adelanto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para nuevo adelanto */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Nuevo Adelanto</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {profile?.role === 'admin' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Cajero *</label>
                  <select
                    value={formData.cajeroId}
                    onChange={(e) => setFormData(prev => ({ ...prev, cajeroId: e.target.value }))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600"
                    required
                  >
                    <option value="">Seleccionar cajero</option>
                    {cajeros.map(cajero => (
                      <option key={cajero.uid} value={cajero.uid}>
                        {cajero.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-sm mb-2">Monto *</label>
                <input
                  type="number"
                  value={formData.monto}
                  onChange={(e) => setFormData(prev => ({ ...prev, monto: e.target.value }))}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Concepto *</label>
                <input
                  type="text"
                  value={formData.concepto}
                  onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600"
                  placeholder="Materiales, gastos, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600"
                  placeholder="Información adicional (opcional)"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Crear Adelanto
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}; 