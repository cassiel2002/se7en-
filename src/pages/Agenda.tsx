import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  Calendar, 
  Plus, 
  Clock, 
  User,
  Scissors,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  DollarSign
} from 'lucide-react';
import { 
  Turno, 
  Cliente, 
  Servicio,
  createTurno, 
  getTurnos, 
  getClientes, 
  getServiciosActivos,
  updateTurno,
  deleteTurno
} from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthUser } from '../hooks/useAuthUser';
import { ButtonLoading } from '../components/GlobalLoading';
import { useNavigate } from 'react-router-dom';

interface TurnoFormData {
  clienteId: string;
  servicioId: string;
  fecha: string;
  hora: string;
}

export const Agenda: React.FC = () => {
  console.log('➡️ Agenda.tsx: Componente Agenda renderizado.');
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TurnoFormData>();

  useEffect(() => {
    if (user && profile) {
      setLoading(true);
      loadData();
    }
  }, [selectedDate, user, profile]);

  const loadData = async () => {
    try {
      const [turnosData, clientesData, serviciosData] = await Promise.all([
        profile?.role === 'admin' ? getTurnos(selectedDate) : getTurnos(selectedDate, user?.uid),
        getClientes(),
        getServiciosActivos()
      ]);
      
      setTurnos(turnosData);
      setClientes(clientesData);
      setServicios(serviciosData);
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: TurnoFormData) => {
    if (!user || !profile || isSubmitting) {
      toast.error('Usuario no autenticado o perfil no cargado, o ya enviando.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const cliente = clientes.find(c => c.id === data.clienteId);
      const servicio = servicios.find(s => s.id === data.servicioId);
      
      if (!cliente || !servicio) {
        toast.error('Cliente o servicio no encontrado');
        return;
      }

      if (!cliente.id || !servicio.id) {
        toast.error('Error: Cliente o servicio sin ID válido');
        return;
      }

      const fechaTurno = new Date(`${data.fecha}T${data.hora}`);

      console.log('📅 Datos para crear turno:', {
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        servicioId: servicio.id,
        servicioNombre: servicio.nombre,
        cajeroId: user.uid,
        cajeroNombre: profile.name || user.displayName || user.email || 'Desconocido',
        fecha: fechaTurno,
        hora: data.hora,
        userUid: user.uid
      });

      await createTurno({
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        servicioId: servicio.id,
        servicioNombre: servicio.nombre,
        cajeroId: user.uid,
        cajeroNombre: profile.name || user.displayName || user.email || 'Desconocido',
        fecha: fechaTurno,
        hora: data.hora,
        estado: 'pendiente'
      });
      
      toast.success('Turno agendado exitosamente');
      reset();
      setShowForm(false);
      loadData();
    } catch (error: any) {
      console.error('Error en onSubmit turno:', error);
      toast.error(error.message || 'Error agendando turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTurnoEstado = async (turno: Turno, nuevoEstado: 'completado' | 'cancelado') => {
    try {
      await updateTurno(turno.id!, { estado: nuevoEstado });
      toast.success(`Turno ${nuevoEstado}`);
      loadData();
    } catch (error) {
      toast.error('Error actualizando turno');
    }
  };

  const handleDeleteTurno = async (turnoId: string) => {
    if (!profile || profile.role !== 'admin') {
      toast.error('No tienes permiso para eliminar turnos.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este turno? Esto no se puede deshacer.')) {
      setDeletingId(turnoId);
      try {
        await deleteTurno(turnoId);
        toast.success('Turno eliminado exitosamente');
        loadData();
      } catch (error) {
        console.error('Error deleting turno:', error);
        toast.error('Error eliminando turno');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'text-yellow-400';
      case 'completado': return 'text-green-400';
      case 'cancelado': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'pendiente': return AlertCircle;
      case 'completado': return CheckCircle;
      case 'cancelado': return XCircle;
      default: return Clock;
    }
  };

  const turnosPendientes = turnos.filter(t => t.estado === 'pendiente');
  const turnosCompletados = turnos.filter(t => t.estado === 'completado');

  const handleRegistrarVenta = (turno: Turno) => {
    // Encontrar el cliente y servicio completos
    const cliente = clientes.find(c => c.id === turno.clienteId);
    const servicio = servicios.find(s => s.id === turno.servicioId);
    
    if (!cliente || !servicio) {
      toast.error('No se encontraron los datos del cliente o servicio');
      return;
    }
    
    // Navegar a ventas con los datos del turno
    navigate('/cajero/ventas', {
      state: {
        prefilledData: {
          cliente: cliente,
          servicio: servicio,
          turnoId: turno.id
        }
      }
    });
    
    toast.success('Redirigiendo a registro de ventas...');
  };

  if (authLoading || loading || !user || !profile) {
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
            <Calendar className="mr-3 text-red-600" size={32} />
            Agenda de Turnos
          </h1>
          <p className="text-gray-400 mt-2">
            Gestiona los turnos y citas
          </p>
        </div>
        
        <button
          onClick={() => {
            setShowForm(true);
            reset();
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus size={20} />
          <span>Nuevo Turno</span>
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          ← Anterior
        </button>
        
        <div className="bg-gray-900 px-6 py-3 rounded-lg border border-gray-800">
          <p className="text-white font-semibold text-lg">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Siguiente →
        </button>
        
        <button
          onClick={() => setSelectedDate(new Date())}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Hoy
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-400">{turnosPendientes.length}</p>
            </div>
            <AlertCircle className="text-yellow-400" size={24} />
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Completados</p>
              <p className="text-2xl font-bold text-green-400">{turnosCompletados.length}</p>
            </div>
            <CheckCircle className="text-green-400" size={24} />
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total</p>
              <p className="text-2xl font-bold text-white">{turnos.length}</p>
            </div>
            <Calendar className="text-red-600" size={24} />
          </div>
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h3 className="text-xl font-semibold text-white mb-4">Nuevo Turno</h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cliente *
              </label>
              <select
                {...register('clienteId', { required: 'Selecciona un cliente' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
              {errors.clienteId && (
                <p className="text-red-500 text-sm mt-1">{errors.clienteId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Servicio *
              </label>
              <select
                {...register('servicioId', { required: 'Selecciona un servicio' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">Seleccionar servicio</option>
                {servicios.map(servicio => (
                  <option key={servicio.id} value={servicio.id}>
                    {servicio.nombre} ({servicio.duracion}min)
                  </option>
                ))}
              </select>
              {errors.servicioId && (
                <p className="text-red-500 text-sm mt-1">{errors.servicioId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                {...register('fecha', { required: 'La fecha es requerida' })}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              {errors.fecha && (
                <p className="text-red-500 text-sm mt-1">{errors.fecha.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Hora *
              </label>
              <input
                type="time"
                {...register('hora', { required: 'La hora es requerida' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              {errors.hora && (
                <p className="text-red-500 text-sm mt-1">{errors.hora.message}</p>
              )}
            </div>

            <div className="lg:col-span-4 flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <ButtonLoading /> : (editingTurno ? 'Actualizar Turno' : 'Agendar Turno')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  reset();
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-4">
        {turnos
          .sort((a, b) => a.hora.localeCompare(b.hora))
          .map((turno, index) => {
            const EstadoIcon = getEstadoIcon(turno.estado);
            
            return (
              <motion.div
                key={turno.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-red-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                      <Calendar className="text-white" size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{turno.clienteNombre}</h3>
                      <p className="text-gray-400 text-sm">{turno.servicioNombre}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {turno.estado === 'pendiente' && (
                      <>
                        <button
                          onClick={() => updateTurnoEstado(turno, 'completado')}
                          className="text-green-400 hover:text-green-300 transition-colors"
                          title="Marcar como completado"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => updateTurnoEstado(turno, 'cancelado')}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Cancelar turno"
                        >
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                    
                    {turno.estado === 'completado' && (
                      <button
                        onClick={() => handleRegistrarVenta(turno)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center space-x-1 transition-colors text-sm"
                        title="Registrar venta de este turno"
                      >
                        <DollarSign size={14} />
                        <span>Registrar Venta</span>
                      </button>
                    )}
                    
                    {profile?.role === 'admin' && (
                      <button
                        onClick={() => turno.id && handleDeleteTurno(turno.id)}
                        disabled={deletingId === turno.id}
                        className="text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
                      >
                        {deletingId === turno.id ? (
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-gray-300">
                    <Clock className="mr-2 text-gray-500" size={16} />
                    <span className="text-sm">{turno.hora}</span>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <User className="mr-2 text-gray-500" size={16} />
                    <span className="text-sm">{turno.cajeroNombre}</span>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <EstadoIcon className={`mr-2 ${getEstadoColor(turno.estado)}`} size={16} />
                    <span className={`text-sm ${getEstadoColor(turno.estado)}`}>{turno.estado}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>

      {turnos.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Calendar className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            No hay turnos para esta fecha
          </h3>
          <p className="text-gray-500">
            Agenda el primer turno del día
          </p>
        </motion.div>
      )}
    </div>
  );
};