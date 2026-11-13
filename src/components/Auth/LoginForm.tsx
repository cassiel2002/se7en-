import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { loginUser } from '../../firebase/auth';
import toast from 'react-hot-toast';
import { getFriendlyErrorMessage } from '../../utils/firebaseErrors';
import { useNavigate } from 'react-router-dom';
import logoSe7en from '../../assets/logo-se7en.jpeg';

interface LoginForm {
  email: string;
  password: string;
}

export const LoginForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await loginUser(data.email, data.password);
      toast.success('¡Bienvenido!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const friendlyMessage = getFriendlyErrorMessage(error);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden px-4">
      {/* Logo difuminado de fondo */}
      <div 
        className="fixed inset-0 opacity-10 bg-center bg-no-repeat bg-contain pointer-events-none"
        style={{
          backgroundImage: `url(${logoSe7en})`,
          filter: 'blur(8px) brightness(0.7) contrast(1.2)'
        }}
      />
      
      {/* Marca de agua "sistema kioskito" */}
      <div className="fixed bottom-4 right-4 pointer-events-none">
        <span className="text-gray-700 text-xs font-light opacity-40 select-none">
          sistema kioskito
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-800 w-full max-w-sm mx-auto"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 flex items-center justify-center">
              <img 
                src={logoSe7en} 
                alt="Se7en Logo" 
                className="w-16 h-16 object-contain rounded-full"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  const fallback = target.nextElementSibling as HTMLElement;
                  target.style.display = 'none';
                  fallback.style.display = 'flex';
                }}
              />
              <div className="w-16 h-16 bg-red-600 rounded-full hidden items-center justify-center">
                <span className="text-white font-bold text-xl">S7</span>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Se7en Barbershop</h1>
          <p className="text-gray-400 text-sm">Sistema de Gestión</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                {...register('email', { 
                  required: 'Email requerido',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Email inválido'
                  }
                })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent text-base min-h-[48px]"
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password', { required: 'Contraseña requerida' })}
                className="w-full pl-4 pr-12 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent text-base min-h-[48px]"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-4 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px] touch-manipulation text-base"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <LogIn size={18} />
                <span>Iniciar Sesión</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Usuarios */}
        <div className="mt-6 text-center">
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="space-y-1 text-xs">
              <div className="bg-gray-900 p-2 rounded border-l-2 border-green-500">
                <p className="text-green-400 font-medium">👨‍💼 faqu</p>
              </div>
              <div className="bg-gray-900 p-2 rounded border-l-2 border-blue-500">
                <p className="text-blue-400 font-medium">💇‍♂️ martins</p>
              </div>
              <div className="bg-gray-900 p-2 rounded border-l-2 border-purple-500">
                <p className="text-purple-400 font-medium">💇‍♂️ ltalamo</p>
              </div>
            </div>
          </div>
          
          <p className="text-gray-400 text-xs mt-3">
            ¿Problemas para acceder? Contacta al administrador
          </p>
        </div>
      </motion.div>
    </div>
  );
};