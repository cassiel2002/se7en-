import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Scissors, 
  ShoppingCart, 
  BarChart3,
  UserPlus,
  LogOut,
  X,
  Star,
  CreditCard,
  Gift,
  Crown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../firebase/auth';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import logoSe7en from '../../assets/logo-se7en.jpeg';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { profile, user, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      console.log('🚪 Iniciando logout...');
      await logoutUser();
      toast.success('Sesión cerrada correctamente');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('❌ Error en logout:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  const handleNavClick = () => {
    // Cerrar sidebar en móviles al hacer clic en un enlace
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const adminMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Clientes', path: '/clientes' },
    { icon: Calendar, label: 'Agenda', path: '/agenda' },
    { icon: Scissors, label: 'Servicios', path: '/servicios' },
    { icon: ShoppingCart, label: 'Ventas', path: '/ventas' },
    { icon: Gift, label: 'Premios', path: '/premios' },
    { icon: BarChart3, label: 'Reportes', path: '/reportes' },
    { icon: UserPlus, label: 'Cajeros', path: '/cajeros' },
    { icon: Crown, label: 'Encargados', path: '/encargados' },
    { icon: CreditCard, label: 'Adelantos', path: '/adelantos' }
  ];

  const cajeroMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Agenda', path: '/cajero/agenda' },
    { icon: Users, label: 'Clientes', path: '/cajero/clientes' },
    { icon: ShoppingCart, label: 'Ventas', path: '/cajero/ventas' },
    { icon: Gift, label: 'Premios', path: '/premios' },
    { icon: CreditCard, label: 'Adelantos', path: '/cajero/adelantos' }
  ];

  const menuItems = profile?.role === 'admin' ? adminMenuItems : cajeroMenuItems;

  // Debug log
  console.log('🔍 Sidebar render - profile:', profile, 'user:', user?.email, 'loading:', loading);

  // Contenido del sidebar
  const sidebarContent = (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full h-screen overflow-hidden">
      {/* Header del sidebar con botón cerrar para móviles */}
      <div className="p-6 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img 
                src={logoSe7en} 
                alt="Se7en Logo" 
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  // Fallback si la imagen no carga
                  const target = e.currentTarget as HTMLImageElement;
                  const fallback = target.nextElementSibling as HTMLElement;
                  target.style.display = 'none';
                  fallback.style.display = 'flex';
                }}
              />
              <div className="w-10 h-10 bg-red-600 rounded-full hidden items-center justify-center">
                <span className="text-white font-bold text-lg">S7</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Se7en</h1>
              <p className="text-sm text-gray-400">Barbershop</p>
            </div>
          </div>
          
          {/* Botón cerrar para móviles */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation min-h-[48px] ${
                    isActive
                      ? 'bg-red-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info and logout - SIEMPRE VISIBLE - FIXED AT BOTTOM */}
      <div className="p-4 pb-8 border-t border-gray-800 safe-area-bottom flex-shrink-0 bg-gray-900">
        {!loading && (profile || user) ? (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-400">Conectado como:</p>
              <p className="text-white font-medium truncate">
                {profile?.name || user?.email || 'Usuario'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {profile?.role || 'usuario'}
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-4 py-4 text-gray-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-gray-700 hover:border-red-600 touch-manipulation min-h-[56px] font-medium"
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="text-center py-4">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-4 py-4 text-gray-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-gray-700 hover:border-red-600 touch-manipulation min-h-[56px] font-medium"
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - visible en pantallas grandes */}
      <div className="hidden lg:block">
        <motion.aside
          initial={{ x: -250 }}
          animate={{ x: 0 }}
          className="relative"
        >
          {sidebarContent}
        </motion.aside>
      </div>

      {/* Mobile Sidebar - overlay con animación */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            />
            
            {/* Sidebar móvil */}
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 h-screen"
              style={{ 
                height: '100dvh' // Dynamic viewport height para mejor soporte móvil
              }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};