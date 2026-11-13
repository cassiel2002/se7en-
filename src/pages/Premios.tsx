import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  Gift,
  Plus,
  Search,
  Star,
  Edit,
  Trash2,
  Award,
  Percent,
  Package
} from 'lucide-react';
import { Premio, createPremio, getPremios, updatePremio, deletePremio } from '../firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ButtonLoading } from '../components/GlobalLoading';

interface PremioFormData {
  nombre: string;
  descripcion: string;
  puntosRequeridos: number;
  tipo: 'descuento' | 'servicio_gratis' | 'producto';
  valor?: number;
  activo: boolean;
}

export const Premios: React.FC = () => {
  const [premios, setPremios] = useState<Premio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPremio, setEditingPremio] = useState<Premio | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasMorePremios, setHasMorePremios] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PremioFormData>();
  const tipoSeleccionado = watch('tipo');

  useEffect(() => {
    loadPremios();
  }, []);

  // Efecto para manejar la búsqueda con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim() !== '') {
        loadPremios(searchTerm);
      } else {
        loadPremios();
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadPremios = async (search?: string) => {
    try {
      const premiosData = await getPremios(20, search);
      setPremios(premiosData);
      setHasMorePremios(premiosData.length === 20); // Si trajo 20, puede haber más
    } catch (error) {
      toast.error('Error cargando premios');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePremios = async () => {
    if (loadingMore || !hasMorePremios || searchTerm.trim() !== '') return;
    
    setLoadingMore(true);
    try {
      const premiosData = await getPremios(premios.length + 20);
      if (premiosData.length > premios.length) {
        setPremios(premiosData);
        setHasMorePremios(premiosData.length === premios.length + 20);
      } else {
        setHasMorePremios(false);
      }
    } catch (error) {
      toast.error('Error cargando más premios');
    } finally {
      setLoadingMore(false);
    }
  };

  const onSubmit = async (data: PremioFormData) => {
    setIsSubmitting(true);
    try {
      console.log('🔄 Guardando premio:', data);
      console.log('📝 Editando premio:', editingPremio);

      // Convertir datos del formulario
      const premioData = {
        nombre: data.nombre.trim(),
        descripcion: data.descripcion.trim(),
        puntosRequeridos: Number(data.puntosRequeridos),
        tipo: data.tipo,
        valor: data.valor ? Number(data.valor) : undefined,
        activo: Boolean(data.activo)
      };

      console.log('📋 Datos procesados:', premioData);

      if (editingPremio && editingPremio.id) {
        console.log('✏️ Actualizando premio con ID:', editingPremio.id);
        await updatePremio(editingPremio.id, premioData);
        toast.success('Premio actualizado correctamente');
      } else {
        console.log('➕ Creando nuevo premio');
        await createPremio(premioData);
        toast.success('Premio creado correctamente');
      }

      console.log('🔄 Recargando lista de premios...');
      await loadPremios();

      console.log('✅ Cerrando formulario');
      setShowForm(false);
      setEditingPremio(null);
      reset();
    } catch (error) {
      console.error('❌ Error guardando premio:', error);
      toast.error(`Error guardando premio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (premio: Premio) => {
    setEditingPremio(premio);
    reset({
      nombre: premio.nombre,
      descripcion: premio.descripcion,
      puntosRequeridos: premio.puntosRequeridos,
      tipo: premio.tipo,
      valor: premio.valor,
      activo: premio.activo
    });
    setShowForm(true);
  };

  const handleDelete = async (premio: Premio) => {
    if (!premio.id) return;

    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar el premio "${premio.nombre}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    setDeletingId(premio.id);
    try {
      await deletePremio(premio.id);
      toast.success('Premio eliminado correctamente');
      await loadPremios();
    } catch (error) {
      toast.error('Error eliminando premio');
    } finally {
      setDeletingId(null);
    }
  };

  // Ya no necesitamos filtrar en el cliente, se hace en la consulta
  const filteredPremios = premios;

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'descuento':
        return <Percent className="w-5 h-5" />;
      case 'servicio_gratis':
        return <Award className="w-5 h-5" />;
      case 'producto':
        return <Package className="w-5 h-5" />;
      default:
        return <Gift className="w-5 h-5" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'descuento':
        return 'bg-blue-600/20 text-blue-400';
      case 'servicio_gratis':
        return 'bg-green-600/20 text-green-400';
      case 'producto':
        return 'bg-purple-600/20 text-purple-400';
      default:
        return 'bg-gray-600/20 text-gray-400';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Gift className="mr-3 text-red-600" size={32} />
            Premios
          </h1>
          <p className="text-gray-400 mt-1">Gestiona los premios del sistema de puntos</p>
        </div>

        {profile?.role === 'admin' && (
          <button
            onClick={() => {
              setEditingPremio(null);
              reset({
                nombre: '',
                descripcion: '',
                puntosRequeridos: 0,
                tipo: 'producto',
                activo: true
              });
              setShowForm(!showForm);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Plus size={20} />
            <span>Nuevo Premio</span>
          </button>
        )}

        {profile?.role !== 'admin' && (
          <div className="bg-blue-600/20 border border-blue-600/30 rounded-lg px-4 py-3">
            <p className="text-blue-400 text-sm">
              📋 Vista de solo lectura - Catálogo de premios disponibles
            </p>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar premios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
        />
      </div>

      {/* Formulario */}
      {showForm && profile?.role === 'admin' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h3 className="text-xl font-semibold text-white mb-4">
            {editingPremio ? 'Editar Premio' : 'Nuevo Premio'}
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                {...register('nombre', { required: 'El nombre es requerido' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Nombre del premio"
              />
              {errors.nombre && (
                <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Puntos Requeridos *
              </label>
              <input
                type="number"
                {...register('puntosRequeridos', {
                  required: 'Los puntos son requeridos',
                  min: { value: 1, message: 'Mínimo 1 punto' }
                })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="10"
              />
              {errors.puntosRequeridos && (
                <p className="text-red-500 text-sm mt-1">{errors.puntosRequeridos.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo *
              </label>
              <select
                {...register('tipo', { required: 'El tipo es requerido' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="producto">Producto</option>
                <option value="servicio_gratis">Servicio Gratis</option>
                <option value="descuento">Descuento</option>
              </select>
            </div>

            {tipoSeleccionado === 'descuento' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Porcentaje de Descuento
                </label>
                <input
                  type="number"
                  {...register('valor', {
                    min: { value: 1, message: 'Mínimo 1%' },
                    max: { value: 100, message: 'Máximo 100%' }
                  })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="50"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descripción *
              </label>
              <textarea
                {...register('descripcion', { required: 'La descripción es requerida' })}
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Descripción del premio"
              />
              {errors.descripcion && (
                <p className="text-red-500 text-sm mt-1">{errors.descripcion.message}</p>
              )}
            </div>

            <div className="md:col-span-2 flex items-center">
              <input
                type="checkbox"
                {...register('activo')}
                className="w-4 h-4 text-red-600 bg-gray-800 border-gray-700 rounded focus:ring-red-600"
              />
              <label className="ml-2 text-sm text-gray-300">
                Premio activo
              </label>
            </div>

            <div className="md:col-span-2 flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <ButtonLoading /> : `${editingPremio ? 'Actualizar' : 'Crear'} Premio`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingPremio(null);
                  reset();
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Lista de Premios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPremios.map((premio, index) => (
          <motion.div
            key={premio.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-red-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${getTipoColor(premio.tipo)}`}>
                {getTipoIcon(premio.tipo)}
              </div>

              {profile?.role === 'admin' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(premio)}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title="Editar premio"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(premio)}
                    disabled={deletingId === premio.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    title="Eliminar premio"
                  >
                    {deletingId === premio.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{premio.nombre}</h3>
                <p className="text-gray-400 text-sm mt-1">{premio.descripcion}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center bg-yellow-600/20 px-3 py-1 rounded-full">
                  <Star className="mr-1 text-yellow-500" size={16} />
                  <span className="text-yellow-400 font-medium">
                    {premio.puntosRequeridos} pts
                  </span>
                </div>

                {premio.tipo === 'descuento' && premio.valor && (
                  <div className="text-blue-400 font-semibold">
                    {premio.valor}% OFF
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${getTipoColor(premio.tipo)}`}>
                  {premio.tipo === 'descuento' ? 'Descuento' :
                    premio.tipo === 'servicio_gratis' ? 'Servicio Gratis' : 'Producto'}
                </span>

                {premio.activo && (
                  <span className="px-2 py-1 rounded-full text-xs bg-green-600/20 text-green-400">
                    Disponible
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Botón Cargar Más */}
      {hasMorePremios && searchTerm.trim() === '' && filteredPremios.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMorePremios}
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
                <span>Cargar más premios</span>
              </>
            )}
          </button>
        </div>
      )}

      {filteredPremios.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Gift className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            {searchTerm ? 'No se encontraron premios' : 'No hay premios configurados'}
          </h3>
          <p className="text-gray-500">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Comienza agregando el primer premio'}
          </p>
        </motion.div>
      )}
    </div>
  );
};