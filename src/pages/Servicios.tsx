import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  Scissors, 
  Plus, 
  Search, 
  DollarSign, 
  Clock,
  Edit,
  Trash2
} from 'lucide-react';
import { Servicio, createServicio, getServicios, updateServicio, deleteServicio } from '../firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ButtonLoading } from '../components/GlobalLoading';

interface ServicioFormData {
  nombre: string;
  precio: number;
  duracion: number;
  descripcion?: string;
}

export const Servicios: React.FC = () => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { profile } = useAuth();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServicioFormData>();

  useEffect(() => {
    loadServicios();
  }, []);

  const loadServicios = async () => {
    try {
      const serviciosData = await getServicios();
      setServicios(serviciosData);
    } catch (error) {
      toast.error('Error cargando servicios');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ServicioFormData) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingServicio) {
        await updateServicio(editingServicio.id!, data);
        toast.success('Servicio actualizado');
      } else {
        await createServicio({
          ...data,
          activo: true
        });
        toast.success('Servicio creado');
      }
      
      reset();
      setShowForm(false);
      setEditingServicio(null);
      loadServicios();
    } catch (error) {
      toast.error('Error guardando servicio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (servicio: Servicio) => {
    setEditingServicio(servicio);
    reset({
      nombre: servicio.nombre,
      precio: servicio.precio,
      duracion: servicio.duracion,
      descripcion: servicio.descripcion || ''
    });
    setShowForm(true);
  };

  const handleDeleteServicio = async (servicioId: string) => {
    if (!profile || profile.role !== 'admin') {
      toast.error('No tienes permiso para eliminar servicios.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este servicio? Esto no se puede deshacer.')) {
      setDeletingId(servicioId);
      try {
        await deleteServicio(servicioId);
        toast.success('Servicio eliminado exitosamente');
        loadServicios();
      } catch (error) {
        console.error('Error deleting servicio:', error);
        toast.error('Error eliminando servicio');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredServicios = servicios
    .filter(servicio => servicio.activo !== false)
    .filter(servicio =>
      servicio.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (servicio.descripcion && servicio.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
            <Scissors className="mr-3 text-red-600" size={32} />
            Gestión de Servicios
          </h1>
          <p className="text-gray-400 mt-2">
            Administra los servicios de la barbería
          </p>
        </div>
        
        <button
          onClick={() => {
            setShowForm(true);
            setEditingServicio(null);
            reset();
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus size={20} />
          <span>Nuevo Servicio</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar servicios..."
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
            {editingServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
          </h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre del Servicio *
              </label>
              <input
                type="text"
                {...register('nombre', { required: 'El nombre es requerido' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Ej: Corte clásico"
              />
              {errors.nombre && (
                <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Precio *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('precio', { 
                  required: 'El precio es requerido',
                  min: { value: 0, message: 'El precio debe ser mayor a 0' }
                })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="0.00"
              />
              {errors.precio && (
                <p className="text-red-500 text-sm mt-1">{errors.precio.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Duración (minutos) *
              </label>
              <input
                type="number"
                {...register('duracion', { 
                  required: 'La duración es requerida',
                  min: { value: 1, message: 'La duración debe ser mayor a 0' }
                })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="30"
              />
              {errors.duracion && (
                <p className="text-red-500 text-sm mt-1">{errors.duracion.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descripción
              </label>
              <input
                type="text"
                {...register('descripcion')}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Descripción del servicio (opcional)"
              />
            </div>

            <div className="md:col-span-2 flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <ButtonLoading /> : (editingServicio ? 'Actualizar' : 'Crear') + ' Servicio'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingServicio(null);
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

      {/* Lista de Servicios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServicios.map((servicio, index) => (
          <motion.div
            key={servicio.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-red-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                  <Scissors className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{servicio.nombre}</h3>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(servicio)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Edit size={16} />
                </button>
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => servicio.id && handleDeleteServicio(servicio.id)}
                    disabled={deletingId === servicio.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {deletingId === servicio.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center text-gray-300">
                <DollarSign className="mr-2 text-gray-500" size={16} />
                <span className="text-sm font-semibold text-green-400">${servicio.precio.toLocaleString()}</span>
              </div>
              <div className="flex items-center text-gray-300">
                <Clock className="mr-2 text-gray-500" size={16} />
                <span className="text-sm">{servicio.duracion} minutos</span>
              </div>
              {servicio.descripcion && (
                <p className="text-gray-400 text-sm leading-relaxed mt-2">
                  {servicio.descripcion}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {filteredServicios.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Scissors className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            {searchTerm ? 'No se encontraron servicios' : 'No hay servicios registrados'}
          </h3>
          <p className="text-gray-500">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando tu primer servicio'}
          </p>
        </motion.div>
      )}
    </div>
  );
};