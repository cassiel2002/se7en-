import React from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const { profile } = useAuth();

  if (!profile) {
    return null;
  }

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Botón hamburguesa para móviles */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-white">
              Bienvenido, {profile.name}
            </h2>
            <p className="text-xs md:text-sm text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            {/* Fecha abreviada para móviles */}
            <p className="text-xs text-gray-400 sm:hidden">
              {new Date().toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
              })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs md:text-sm text-gray-400">Rol:</p>
            <p className="text-xs md:text-sm font-medium text-white capitalize">{profile.role}</p>
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs md:text-sm font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </motion.header>
  );
};