import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary capturó un error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Si hay un componente fallback personalizado, usarlo
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      // Componente de error por defecto
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 sm:p-8 border border-gray-800 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-white" size={32} />
            </div>
            
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
              ¡Oops! Algo salió mal
            </h1>
            
            <p className="text-gray-400 mb-6 text-sm sm:text-base">
              Se produjo un error inesperado. No te preocupes, esto pasa a veces.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
                <p className="text-red-400 text-sm font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.resetError}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]"
              >
                <RefreshCw size={18} />
                <span>Intentar de nuevo</span>
              </button>
              
              <button
                onClick={() => window.location.href = '/se7en/'}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]"
              >
                <Home size={18} />
                <span>Ir al inicio</span>
              </button>
            </div>
            
            <p className="text-gray-500 text-xs mt-4">
              Si el problema persiste, contacta al administrador
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook para manejar errores async
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: string) => {
    console.error('🚨 Error async capturado:', error, errorInfo);
    
    // En desarrollo, mostrar el error
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
    
    // En producción, solo loggearlo
    // Aquí podrías enviar el error a un servicio de monitoreo
  };
}; 