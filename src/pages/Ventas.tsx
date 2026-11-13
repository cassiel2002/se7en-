import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  DollarSign, 
  Calendar,
  User,
  Scissors,
  Filter,
  CreditCard, // For DNI icon
  Trash2,
  Banknote,
  Clock
} from 'lucide-react';
import { 
  Venta, 
  Cliente, 
  Servicio,
  createVenta, 
  getVentas, 
  getClientes, 
  getServiciosActivos,
  deleteVenta,
  createCliente
} from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ButtonLoading } from '../components/GlobalLoading';
import { useLocation } from 'react-router-dom';

interface VentaFormData {
  clienteId: string;
  servicioId: string;
  metodoPago: 'efectivo' | 'transferencia';
  // Campos para cliente nuevo
  nuevoClienteNombre?: string;
  nuevoClienteTelefono?: string;
  nuevoClienteDni?: string;
}

export const Ventas: React.FC = () => {
  const { profile, user, loading } = useAuth();
  const location = useLocation();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [clienteSearchTerm, setClienteSearchTerm] = useState(''); // New state for client search
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null); // New state for selected client
  const [isSubmitting, setIsSubmitting] = useState(false); // Nuevo estado
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fromTurno, setFromTurno] = useState<boolean>(false);
  const [showCreateClient, setShowCreateClient] = useState(false); // Estado para mostrar formulario de cliente nuevo
  const [periodoFiltro, setPeriodoFiltro] = useState('hoy'); // Filtro por período - por defecto "hoy"
  const [hasMoreVentas, setHasMoreVentas] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<VentaFormData>(); // Destructure setValue

  useEffect(() => {
    loadData();
  }, [profile, user, periodoFiltro]);

  // Efecto para manejar la búsqueda con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (profile && user) {
        loadData();
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Efecto para manejar datos pre-llenados del turno
  useEffect(() => {
    const prefilledData = location.state?.prefilledData;
    if (prefilledData) {
      const { cliente, servicio, turnoId } = prefilledData;
      
      // Pre-llenar formulario
      setSelectedClient(cliente);
      setClienteSearchTerm(`${cliente.nombre} ${cliente.dni ? `(${cliente.dni})` : ''}`);
      setValue('clienteId', cliente.id || '');
      setValue('servicioId', servicio.id || '');
      setFromTurno(true);
      setShowForm(true);
      
      toast.success(`Datos cargados desde turno: ${cliente.nombre} - ${servicio.nombre}`);
      
      // Limpiar el state de navegación
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setValue]);

  const loadData = async () => {
    if (!profile || !user) {
      console.log('🚫 loadData in Ventas.tsx: User profile or user object not available.', { profile, user });
      return;
    }
    
    console.log(`🔍 loadData in Ventas.tsx: Attempting to load data for user ${user.uid} with role ${profile.role}`);

    try {
      const cajeroIdFiltro = profile.role === 'admin' ? undefined : user.uid;
      
      // Calcular fechas según el período seleccionado
      let fechaInicio: Date | undefined;
      let fechaFin: Date | undefined;
      
      if (periodoFiltro === 'hoy') {
        // Solo ventas de hoy
        fechaInicio = new Date();
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date();
        fechaFin.setHours(23, 59, 59, 999);
      } else if (periodoFiltro !== 'all') {
        fechaFin = new Date();
        fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - parseInt(periodoFiltro));
      }
      
      const [ventasData, clientesData, serviciosData] = await Promise.all([
        getVentas(cajeroIdFiltro, fechaInicio, fechaFin, 20, searchTerm),
        getClientes(), // TODOS los clientes para formularios
        getServiciosActivos()
      ]);

      // SEGURIDAD ADICIONAL: Filtrar del lado del cliente para cajeros
      if (profile.role === 'cashier' && user.uid) {
        const ventasFiltradas = ventasData.filter(venta => venta.cajeroId === user.uid);
        setVentas(ventasFiltradas);
        setHasMoreVentas(ventasFiltradas.length === 20);
      } else {
        setVentas(ventasData);
        setHasMoreVentas(ventasData.length === 20);
      }
      
      setClientes(clientesData);
      setServicios(serviciosData);
    } catch (error) {
      toast.error('Error cargando datos');
    }
  };

  const handlePeriodoChange = (nuevoPeriodo: string) => {
    setPeriodoFiltro(nuevoPeriodo);
    // Recargar datos con el nuevo período
    loadData();
  };

  const loadMoreVentas = async () => {
    if (loadingMore || !hasMoreVentas || searchTerm.trim() !== '' || periodoFiltro !== 'hoy') return;
    
    setLoadingMore(true);
    try {
      const cajeroIdFiltro = profile?.role === 'admin' ? undefined : user?.uid;
      
      // Calcular fechas para "hoy"
      const fechaInicio = new Date();
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date();
      fechaFin.setHours(23, 59, 59, 999);
      
      const ventasData = await getVentas(cajeroIdFiltro, fechaInicio, fechaFin, ventas.length + 20);
      
      if (ventasData.length > ventas.length) {
        if (profile?.role === 'cashier' && user?.uid) {
          const ventasFiltradas = ventasData.filter(venta => venta.cajeroId === user.uid);
          setVentas(ventasFiltradas);
          setHasMoreVentas(ventasFiltradas.length === ventas.length + 20);
        } else {
          setVentas(ventasData);
          setHasMoreVentas(ventasData.length === ventas.length + 20);
        }
      } else {
        setHasMoreVentas(false);
      }
    } catch (error) {
      toast.error('Error cargando más ventas');
    } finally {
      setLoadingMore(false);
    }
  };

  const onSubmit = async (data: VentaFormData) => {
    if (!user) {
      toast.error('Usuario no autenticado');
      return;
    }

    const selectedService = servicios.find(s => s.id === data.servicioId);
    if (!selectedService) {
      toast.error('Servicio no encontrado');
      return;
    }

    setIsSubmitting(true);
    
    try {
      let clienteParaVenta = selectedClient;

      // Si no hay cliente seleccionado pero hay datos para crear uno nuevo
      if (!selectedClient && showCreateClient) {
        if (!data.nuevoClienteNombre || !data.nuevoClienteTelefono) {
          toast.error('Completa al menos nombre y teléfono del cliente');
          setIsSubmitting(false);
          return;
        }

        // Crear nuevo cliente
        const nuevoCliente = {
          nombre: data.nuevoClienteNombre,
          telefono: data.nuevoClienteTelefono,
          dni: data.nuevoClienteDni || undefined, // DNI opcional
          visitas: 0
        };

        console.log('🆕 Creando nuevo cliente:', nuevoCliente);
        const clienteId = await createCliente(nuevoCliente);
        clienteParaVenta = {
          id: clienteId,
          ...nuevoCliente,
          createdAt: new Date()
        };
        
        // Recargar lista de clientes
        await loadData();
        toast.success('Cliente creado exitosamente');
      }

      if (!clienteParaVenta) {
        toast.error('Selecciona un cliente válido o crea uno nuevo');
        setIsSubmitting(false);
        return;
      }

      const ventaData = {
        clienteId: clienteParaVenta.id || '',
        clienteNombre: clienteParaVenta.nombre,
        servicioId: data.servicioId,
        servicioNombre: selectedService.nombre,
        precio: selectedService.precio,
        metodoPago: data.metodoPago,
        fecha: new Date(),
        cajeroNombre: profile?.name || user.email || 'Desconocido'
      };

      console.log('🛒 Datos de venta a enviar:', ventaData);
      
      await createVenta(ventaData, user);
      
      toast.success('Venta registrada exitosamente');
      setShowForm(false);
      setFromTurno(false);
      setShowCreateClient(false);
      reset();
      setSelectedClient(null);
      setClienteSearchTerm('');
      loadData(); // Recargar datos
    } catch (error) {
      console.error('Error creating venta:', error);
      toast.error('Error al registrar la venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter clients based on search term
  const filteredClients = clientes.filter(cliente =>
    cliente.nombre.toLowerCase().includes(clienteSearchTerm.toLowerCase()) ||
    (cliente.dni && cliente.dni.includes(clienteSearchTerm))
  );

  const filteredVentas = ventas.filter(venta => {
    const matchesSearch = 
      venta.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.servicioNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.cajeroNombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !dateFilter || 
      venta.fecha.toDateString() === new Date(dateFilter).toDateString();
    
    return matchesSearch && matchesDate;
  });

  // Calcular total de ventas (solo para admin)
  const totalVentas = filteredVentas.reduce((sum, venta) => sum + venta.precio, 0);

  const handleDeleteVenta = async (ventaId: string) => {
    // Ensure user and profile are available before proceeding
    if (!user || !profile) {
      toast.error('Usuario no autenticado o perfil no cargado.');
      return;
    }

    const ventaToDelete = ventas.find(venta => venta.id === ventaId);

    if (!ventaToDelete) {
      toast.error('Venta no encontrada.');
      return;
    }

    // Admin can delete any sale
    // Cashier can only delete their own sales
    if (profile.role === 'cashier' && ventaToDelete.cajeroId !== user.uid) {
      toast.error('No tienes permiso para eliminar esta venta. Solo puedes eliminar tus propias ventas.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar esta venta?')) {
      setDeletingId(ventaId);
      try {
        await deleteVenta(ventaId);
        toast.success('Venta eliminada exitosamente');
        loadData(); // Reload data after deletion
      } catch (error) {
        console.error('Error deleting venta:', error);
        toast.error('Error eliminando venta');
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (loading || !profile) {
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
            <ShoppingCart className="mr-2 sm:mr-3 text-red-600" size={24} />
            <span className="truncate">Gestión de Ventas</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">
            Registra y administra las ventas
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Total solo visible para admin */}
          {profile?.role === 'admin' && (
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-gray-400 text-sm">Total: </span>
              <span className="text-green-400 font-bold">${totalVentas.toLocaleString()}</span>
            </div>
          )}
          <button
            onClick={() => {
              setShowForm(true);
              setShowCreateClient(false);
              setSelectedClient(null);
              setClienteSearchTerm('');
              reset();
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors touch-manipulation min-h-[44px] flex-shrink-0"
          >
            <Plus size={20} />
            <span className="whitespace-nowrap">Nueva Venta</span>
          </button>
        </div>
      </div>

      {/* Controles de Filtro por Período */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <Clock className="text-gray-400" size={16} />
            <span className="text-gray-300 text-sm font-medium">Período:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={periodoFiltro} 
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="hoy">Hoy</option>
              <option value="7">Última semana</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 3 meses</option>
              <option value="365">Último año</option>
              <option value="all">Ver todas</option>
            </select>
            <div className="text-xs text-gray-400 flex items-center">
              📊 Mostrando {filteredVentas.length} ventas
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar ventas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Nueva Venta</h3>
            {fromTurno && (
              <div className="flex items-center space-x-2 bg-green-600/20 border border-green-600/30 rounded-lg px-3 py-1">
                <Clock className="text-green-400" size={16} />
                <span className="text-green-400 text-sm font-medium">Desde Turno</span>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Cliente *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateClient(!showCreateClient);
                    setSelectedClient(null);
                    setClienteSearchTerm('');
                    setValue('clienteId', '');
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showCreateClient ? 'Buscar existente' : '+ Crear nuevo'}
                </button>
              </div>

              {!showCreateClient ? (
                <>
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o DNI..."
                    value={clienteSearchTerm}
                    onChange={(e) => {
                      setClienteSearchTerm(e.target.value);
                      setSelectedClient(null);
                      setValue('clienteId', '');
                    }}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  {clienteSearchTerm && filteredClients.length > 0 && (
                    <ul className="bg-gray-800 border border-gray-700 rounded-lg mt-2 max-h-48 overflow-y-auto z-10 relative">
                      {filteredClients.map(cliente => (
                        <li
                          key={cliente.id}
                          className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white"
                          onClick={() => {
                            setSelectedClient(cliente);
                            setClienteSearchTerm(`${cliente.nombre} ${cliente.dni ? `(${cliente.dni})` : ''}`);
                            setValue('clienteId', cliente.id || '');
                          }}
                        >
                          {cliente.nombre} {cliente.dni && <span className="text-gray-400">({cliente.dni})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!selectedClient && clienteSearchTerm && filteredClients.length === 0 && (
                    <div className="mt-2">
                      <p className="text-yellow-500 text-sm">No se encontraron clientes.</p>
                      <button
                        type="button"
                        onClick={() => setShowCreateClient(true)}
                        className="text-sm text-blue-400 hover:text-blue-300 mt-1"
                      >
                        ¿Crear nuevo cliente?
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nombre del cliente *"
                    {...register('nuevoClienteNombre')}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono *"
                    {...register('nuevoClienteTelefono')}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <input
                    type="text"
                    placeholder="DNI (opcional)"
                    {...register('nuevoClienteDni')}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <p className="text-xs text-gray-400">
                    💡 El DNI es opcional. Si no lo conoces, déjalo vacío.
                  </p>
                </div>
              )}
              
              {errors.clienteId && !showCreateClient && (
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
                    {servicio.nombre} - ${servicio.precio}
                  </option>
                ))}
              </select>
              {errors.servicioId && (
                <p className="text-red-500 text-sm mt-1">{errors.servicioId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Método de Pago *
              </label>
              <select
                {...register('metodoPago', { required: 'Selecciona un método de pago' })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">Seleccionar método</option>
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia</option>
              </select>
              {errors.metodoPago && (
                <p className="text-red-500 text-sm mt-1">{errors.metodoPago.message}</p>
              )}
            </div>

            <div className="md:col-span-2 flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <ButtonLoading /> : 'Registrar Venta'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFromTurno(false);
                  setShowCreateClient(false);
                  setSelectedClient(null);
                  setClienteSearchTerm('');
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
        {filteredVentas.map((venta, index) => (
          <motion.div
            key={venta.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-red-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <ShoppingCart className="text-white" size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{venta.clienteNombre}</h3>
                  <p className="text-gray-400 text-sm">{venta.servicioNombre}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => venta.id && handleDeleteVenta(venta.id)}
                    disabled={deletingId === venta.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {deletingId === venta.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center text-gray-300">
                <DollarSign className="mr-2 text-gray-500" size={16} />
                <span className="text-sm font-semibold text-green-400">${venta.precio.toLocaleString()}</span>
              </div>
              <div className="flex items-center text-gray-300">
                <Calendar className="mr-2 text-gray-500" size={16} />
                <span className="text-sm">
                  {venta.fecha && isValid(venta.fecha) && !isNaN(venta.fecha.getTime()) ? format(venta.fecha, 'dd/MM/yyyy HH:mm', { locale: es }) : 'Fecha no disponible'}
                </span>
              </div>
              <div className="flex items-center text-gray-300">
                {venta.metodoPago === 'efectivo' ? (
                  <Banknote className="mr-2 text-green-500" size={16} />
                ) : (
                  <CreditCard className="mr-2 text-blue-500" size={16} />
                )}
                <span className="text-sm">
                  {venta.metodoPago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}
                </span>
              </div>
              <div className="flex items-center text-gray-300">
                <User className="mr-2 text-gray-500" size={16} />
                <span className="text-sm">
                  {/* Mostrar nombre actual si la venta pertenece al usuario actual, sino mostrar nombre histórico */}
                  {venta.cajeroId === user?.uid ? profile?.name || venta.cajeroNombre : venta.cajeroNombre}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Botón Cargar Más */}
      {hasMoreVentas && searchTerm.trim() === '' && periodoFiltro === 'hoy' && filteredVentas.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMoreVentas}
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
                <span>Cargar más ventas</span>
              </>
            )}
          </button>
        </div>
      )}

      {filteredVentas.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <ShoppingCart className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            {searchTerm || dateFilter ? 'No se encontraron ventas' : 'No hay ventas registradas'}
          </h3>
          <p className="text-gray-500">
            {searchTerm || dateFilter ? 'Intenta con otros filtros' : 'Comienza registrando tu primera venta'}
          </p>
        </motion.div>
      )}
    </div>
  );
};