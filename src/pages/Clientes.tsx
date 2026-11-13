import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Calendar,
  Edit,
  Trash2,
  User,
  CreditCard,
  Star,
  Gift
} from 'lucide-react';
import { Cliente, createCliente, getClientes, getClientesPaginados, updateCliente, deleteCliente, getClientesCount, getPremios, canjearPuntos } from '../firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ButtonLoading } from '../components/GlobalLoading';

interface ClienteFormData {
  nombre: string;
  telefono: string;
  email?: string;
  dni?: string;
}

export const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasMoreClientes, setHasMoreClientes] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<'nombre' | 'fecha' | 'puntos'>('nombre');
  const [totalClientes, setTotalClientes] = useState(0);
  
  // Estados para sistema de canje
  const [showCanjeModal, setShowCanjeModal] = useState(false);
  const [clienteParaCanje, setClienteParaCanje] = useState<Cliente | null>(null);
  const [premiosDisponibles, setPremiosDisponibles] = useState<any[]>([]);
  const [loadingPremios, setLoadingPremios] = useState(false);
  const [canjeando, setCanjeando] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClienteFormData>();

  useEffect(() => {
    loadClientes();
    loadTotalClientes();
  }, []);

  const loadTotalClientes = async () => {
    try {
      const total = await getClientesCount();
      setTotalClientes(total);
    } catch (error) {
      console.error('Error cargando total de clientes');
    }
  };

  // Función para abrir modal de canje
  const handleOpenCanje = async (cliente: Cliente) => {
    if (!cliente.puntos || cliente.puntos < 1) {
      toast.error('El cliente no tiene puntos suficientes para canjear');
      return;
    }

    setClienteParaCanje(cliente);
    setLoadingPremios(true);
    setShowCanjeModal(true);

    try {
      // Cargar todos los premios activos
      const premios = await getPremios(100); // Cargar más premios para asegurar que estén todos
      
      // Filtrar premios disponibles para este cliente
      const disponibles = premios.filter(premio => 
        premio.activo && 
        premio.puntosRequeridos <= cliente.puntos
      );

      setPremiosDisponibles(disponibles);
      
      if (disponibles.length === 0) {
        toast.info(`${cliente.nombre} tiene ${cliente.puntos} puntos, pero no hay premios disponibles`);
      }
    } catch (error) {
      toast.error('Error cargando premios disponibles');
      setShowCanjeModal(false);
    } finally {
      setLoadingPremios(false);
    }
  };

  // Función para realizar el canje
  const handleCanjearPremio = async (premioId: string) => {
    if (!clienteParaCanje || !user) {
      toast.error('Error en los datos del canje');
      return;
    }

    setCanjeando(true);
    try {
      await canjearPuntos(clienteParaCanje.id!, premioId, user);
      
      toast.success(`¡Premio canjeado exitosamente para ${clienteParaCanje.nombre}!`);
      
      // Recargar clientes para actualizar puntos
      await loadClientes();
      
      // Cerrar modal
      setShowCanjeModal(false);
      setClienteParaCanje(null);
      setPremiosDisponibles([]);
      
    } catch (error: any) {
      toast.error(error.message || 'Error realizando el canje');
    } finally {
      setCanjeando(false);
    }
  };

  // Función para cerrar modal
  const handleCloseCanje = () => {
    setShowCanjeModal(false);
    setClienteParaCanje(null);
    setPremiosDisponibles([]);
  };

  const loadClientes = async (search?: string) => {
    try {
      const clientesData = await getClientesPaginados(10, search);
      setClientes(clientesData);
      setHasMoreClientes(clientesData.length === 10); // Si trajo 10, puede haber más
    } catch (error) {
      toast.error('Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreClientes = async () => {
    if (loadingMore || !hasMoreClientes || searchTerm.trim() !== '') return;
    
    setLoadingMore(true);
    try {
      const clientesData = await getClientesPaginados(clientes.length + 10);
      if (clientesData.length > clientes.length) {
        setClientes(clientesData);
        setHasMoreClientes(clientesData.length === clientes.length + 10);
      } else {
        setHasMoreClientes(false);
      }
    } catch (error) {
      toast.error('Error cargando más clientes');
    } finally {
      setLoadingMore(false);
    }
  };

  const onSubmit = async (data: ClienteFormData) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id!, data);
        toast.success('Cliente actualizado');
      } else {
        await createCliente({
          ...data,
          visitas: 0,
          dni: data.dni || undefined
        });
        toast.success('Cliente creado');
      }
      
      reset();
      setShowForm(false);
      setEditingCliente(null);
      loadClientes();
    } catch (error) {
      toast.error('Error guardando cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    reset({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email || '',
      dni: cliente.dni || ''
    });
    setShowForm(true);
  };

  const handleDeleteCliente = async (clienteId: string) => {
    if (!profile || profile.role !== 'admin') {
      toast.error('No tienes permiso para eliminar clientes.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente? Esto no se puede deshacer.')) {
      setDeletingId(clienteId);
      try {
        await deleteCliente(clienteId);
        toast.success('Cliente eliminado exitosamente');
        loadClientes();
      } catch (error) {
        console.error('Error deleting cliente:', error);
        toast.error('Error eliminando cliente');
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Efecto para manejar la búsqueda
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim() !== '') {
        loadClientes(searchTerm);
      } else {
        loadClientes();
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Función para ordenar clientes
  const sortedClientes = [...clientes].sort((a, b) => {
    switch (sortBy) {
      case 'nombre':
        return a.nombre.localeCompare(b.nombre);
      case 'fecha':
        return b.createdAt.getTime() - a.createdAt.getTime(); // Más recientes primero
      case 'puntos':
        return (b.puntos || 0) - (a.puntos || 0); // Más puntos primero
      default:
        return 0;
    }
  });

  const filteredClientes = sortedClientes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
            <Users className="mr-2 sm:mr-3 text-red-600" size={24} />
            <span className="truncate">Gestión de Clientes</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">
            Administra la base de datos de clientes
          </p>
          <div className="mt-2 flex items-center space-x-4">
            <div className="bg-blue-600/20 px-3 py-1 rounded-full">
              <span className="text-blue-400 text-sm font-medium">
                📊 Total: {totalClientes} clientes
              </span>
            </div>
            <div className="bg-gray-800/50 px-3 py-1 rounded-full">
              <span className="text-gray-400 text-sm">
                📋 Mostrando: {filteredClientes.length}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCliente(null);
            reset();
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors touch-manipulation min-h-[44px] flex-shrink-0"
        >
          <Plus size={20} />
          <span className="whitespace-nowrap">Nuevo Cliente</span>
        </button>
      </div>

      {/* Buscador y Ordenamiento */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
        
        {/* Controles de Ordenamiento */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-gray-400 text-sm font-medium">Ordenar por:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('nombre')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                sortBy === 'nombre' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              📝 Alfabético
            </button>
            <button
              onClick={() => setSortBy('fecha')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                sortBy === 'fecha' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              📅 Fecha
            </button>
            <button
              onClick={() => setSortBy('puntos')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                sortBy === 'puntos' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              ⭐ Puntos
            </button>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h3 className="text-xl font-semibold text-white mb-4">
            {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                {...register('nombre', { required: 'El nombre es requerido' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                placeholder="Nombre completo"
              />
              {errors.nombre && (
                <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Teléfono *
              </label>
              <input
                type="tel"
                {...register('telefono', { required: 'El teléfono es requerido' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                placeholder="Número de teléfono"
              />
              {errors.telefono && (
                <p className="text-red-500 text-sm mt-1">{errors.telefono.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Email (opcional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                DNI (Opcional)
              </label>
              <input
                type="text"
                {...register('dni')}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="DNI o identificación"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-3 sm:space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] flex items-center justify-center"
              >
                {isSubmitting ? <ButtonLoading /> : (editingCliente ? 'Actualizar' : 'Crear') + ' Cliente'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingCliente(null);
                  reset();
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
              >
                Cancelar
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Lista de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClientes.map((cliente, index) => (
          <motion.div
            key={cliente.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-red-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                <User className="text-white" size={20} />
              </div>
              <div className="flex space-x-2">
                {/* Botón de canje - visible para todos si el cliente tiene puntos */}
                {(cliente.puntos || 0) >= 1 && (
                  <button
                    onClick={() => handleOpenCanje(cliente)}
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                    title={`Canjear premio (${cliente.puntos} puntos)`}
                  >
                    <Gift size={16} />
                  </button>
                )}
                
                <button
                  onClick={() => handleEdit(cliente)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Edit size={16} />
                </button>
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => cliente.id && handleDeleteCliente(cliente.id)}
                    disabled={deletingId === cliente.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {deletingId === cliente.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{cliente.nombre}</h3>
                {cliente.dni && (
                  <p className="text-gray-400 text-sm flex items-center mt-1">
                    <CreditCard className="mr-2 text-gray-500" size={14} />
                    DNI: {cliente.dni}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-gray-400 text-sm">{cliente.visitas} visitas</p>
                  <div className="flex items-center bg-yellow-600/20 px-2 py-1 rounded-full">
                    <Star className="mr-1 text-yellow-500" size={14} />
                    <span className="text-yellow-400 text-sm font-medium">
                      {cliente.puntos || 0} pts
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center text-gray-300">
                <Phone className="mr-2 text-gray-500" size={16} />
                <span className="text-sm">{cliente.telefono}</span>
              </div>
              
              {cliente.email && (
                <div className="flex items-center text-gray-300">
                  <Mail className="mr-2 text-gray-500" size={16} />
                  <span className="text-sm">{cliente.email}</span>
                </div>
              )}
              
              {cliente.ultimaVisita && (
                <div className="flex items-center text-gray-300">
                  <Calendar className="mr-2 text-gray-500" size={16} />
                  <span className="text-sm">
                    Última visita: {cliente.ultimaVisita.toLocaleDateString('es-ES')}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Botón Cargar Más */}
      {hasMoreClientes && searchTerm.trim() === '' && filteredClientes.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMoreClientes}
            disabled={loadingMore}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cargando...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Cargar más clientes</span>
              </>
            )}
          </button>
        </div>
      )}

      {filteredClientes.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Users className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </h3>
          <p className="text-gray-500">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer cliente'}
          </p>
        </motion.div>
      )}

      {/* Modal de Canje de Premios */}
      {showCanjeModal && clienteParaCanje && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <Gift className="mr-2 text-yellow-500" size={24} />
                Canjear Premio
              </h3>
              <button
                onClick={handleCloseCanje}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-300">
                <strong>{clienteParaCanje.nombre}</strong>
              </p>
              <p className="text-yellow-400 flex items-center mt-1">
                <Star className="mr-1" size={16} />
                {clienteParaCanje.puntos} puntos disponibles
              </p>
            </div>

            {loadingPremios ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                <span className="ml-2 text-gray-400">Cargando premios...</span>
              </div>
            ) : premiosDisponibles.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {premiosDisponibles.map((premio) => (
                  <div
                    key={premio.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">{premio.nombre}</h4>
                      <div className="flex items-center bg-yellow-600/20 px-2 py-1 rounded-full">
                        <Star className="mr-1 text-yellow-500" size={14} />
                        <span className="text-yellow-400 text-sm">
                          {premio.puntosRequeridos} pts
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-400 text-sm mb-3">{premio.descripcion}</p>
                    
                    {premio.tipo === 'descuento' && premio.valor && (
                      <div className="text-blue-400 font-semibold text-sm mb-3">
                        {premio.valor}% de descuento
                      </div>
                    )}
                    
                    <button
                      onClick={() => handleCanjearPremio(premio.id)}
                      disabled={canjeando}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {canjeando ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Canjeando...
                        </>
                      ) : (
                        <>
                          <Gift className="mr-2" size={16} />
                          Canjear Premio
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gift className="mx-auto text-gray-600 mb-4" size={48} />
                <p className="text-gray-400 mb-2">No hay premios disponibles</p>
                <p className="text-gray-500 text-sm">
                  {clienteParaCanje.nombre} necesita más puntos para canjear premios
                </p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-800">
              <button
                onClick={handleCloseCanje}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};