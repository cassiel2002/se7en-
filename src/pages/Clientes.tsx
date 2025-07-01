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
  CreditCard
} from 'lucide-react';
import { Cliente, createCliente, getClientes, updateCliente, deleteCliente } from '../firebase/firestore';
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
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClienteFormData>();

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      const clientesData = await getClientes();
      setClientes(clientesData);
    } catch (error) {
      toast.error('Error cargando clientes');
    } finally {
      setLoading(false);
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

  const filteredClientes = clientes.filter(cliente =>
    cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefono.includes(searchTerm) ||
    (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (cliente.dni && cliente.dni.includes(searchTerm))
  );

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

      {/* Buscador */}
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
                <p className="text-gray-400 text-sm">{cliente.visitas} visitas</p>
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
    </div>
  );
};