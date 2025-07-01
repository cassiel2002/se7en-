import React from 'react';
import { motion } from 'framer-motion';
import logoSe7en from '../assets/logo-se7en.jpeg';

interface GlobalLoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

export const GlobalLoading: React.FC<GlobalLoadingProps> = ({ 
  message = "Cargando...", 
  size = 'medium',
  fullScreen = true 
}) => {
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-16 w-16'
  };

  const containerClasses = fullScreen 
    ? "min-h-screen bg-black flex items-center justify-center p-4"
    : "flex items-center justify-center p-4";

  return (
    <div className={containerClasses}>
      <div className="text-center">
        {/* Logo animado */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <img 
              src={logoSe7en} 
              alt="Se7en Logo" 
              className="w-20 h-20 object-contain rounded-full"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                const fallback = target.nextElementSibling as HTMLElement;
                target.style.display = 'none';
                fallback.style.display = 'flex';
              }}
            />
            <div className="w-20 h-20 bg-red-600 rounded-full hidden items-center justify-center">
              <span className="text-white font-bold text-2xl">S7</span>
            </div>
            
            {/* Anillo de carga alrededor del logo */}
            <motion.div
              className="absolute inset-0 border-4 border-transparent border-t-red-600 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>

        {/* Spinner principal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <div className={`${sizeClasses[size]} border-4 border-gray-700 border-t-red-600 rounded-full animate-spin mx-auto`} />
        </motion.div>

        {/* Mensaje de carga */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-white text-lg font-medium mb-2">{message}</p>
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-red-600 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Texto adicional */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-400 text-sm mt-4"
        >
          Preparando tu experiencia Se7en...
        </motion.p>
      </div>
    </div>
  );
};

// Loading para componentes específicos
export const InlineLoading: React.FC<{ message?: string }> = ({ message = "Cargando..." }) => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-gray-700 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
};

// Loading para botones
export const ButtonLoading: React.FC = () => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="h-4 w-4 border-2 border-gray-300 border-t-white rounded-full animate-spin" />
      <span>Procesando...</span>
    </div>
  );
}; 