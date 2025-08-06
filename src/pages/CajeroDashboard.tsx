import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, Calendar, ShoppingCart, PlusCircle, UserPlus, DollarSign, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

export const CajeroDashboard: React.FC = () => {
  const navigate = useNavigate();

  const menuItems = [
    { icon: Users, label: 'Clientes', path: 'clientes' },
    { icon: Calendar, label: 'Agenda', path: 'agenda' },
    { icon: ShoppingCart, label: 'Ventas', path: 'ventas' },
    { icon: CreditCard, label: 'Adelantos', path: 'adelantos' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6"
    >
      <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center mb-6">
        Panel del Cajero
      </h1>
      
      {/* Quick Access Buttons - Optimizados para móviles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('agenda')}
          className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 md:p-8 rounded-lg shadow-lg flex flex-col items-center justify-center space-y-2 transform transition-all duration-300 hover:shadow-xl min-h-[120px] touch-manipulation"
        >
          <PlusCircle size={32} className="md:w-10 md:h-10" />
          <span className="text-base md:text-lg font-semibold text-center">Nuevo Turno</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('clientes')}
          className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 md:p-8 rounded-lg shadow-lg flex flex-col items-center justify-center space-y-2 transform transition-all duration-300 hover:shadow-xl min-h-[120px] touch-manipulation"
        >
          <UserPlus size={32} className="md:w-10 md:h-10" />
          <span className="text-base md:text-lg font-semibold text-center">Nuevo Cliente</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('ventas')}
          className="bg-gradient-to-r from-green-600 to-green-800 text-white p-6 md:p-8 rounded-lg shadow-lg flex flex-col items-center justify-center space-y-2 transform transition-all duration-300 hover:shadow-xl min-h-[120px] touch-manipulation"
        >
          <DollarSign size={32} className="md:w-10 md:h-10" />
          <span className="text-base md:text-lg font-semibold text-center">Registrar Venta</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('adelantos')}
          className="bg-gradient-to-r from-orange-600 to-orange-800 text-white p-6 md:p-8 rounded-lg shadow-lg flex flex-col items-center justify-center space-y-2 transform transition-all duration-300 hover:shadow-xl min-h-[120px] touch-manipulation"
        >
          <CreditCard size={32} className="md:w-10 md:h-10" />
          <span className="text-base md:text-lg font-semibold text-center">Mis Adelantos</span>
        </motion.button>
      </div>

      <nav className="bg-gray-900 rounded-lg p-3 md:p-4 flex flex-wrap gap-2 md:gap-4 border border-gray-800">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3 py-2 md:px-4 md:py-3 rounded-md transition-colors text-sm font-medium min-h-[44px] touch-manipulation ${
                isActive
                  ? 'bg-red-700 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Aquí se cargan las subrutas */}
      <div className="mt-6">
        <Outlet />
      </div>
    </motion.div>
  );
}; 