import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      setIsInstalled(true);
      return;
    }

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar el prompt después de un retraso
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    // Escuchar cuando la app se instala
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('🎉 Usuario aceptó instalar la PWA');
      } else {
        console.log('❌ Usuario rechazó instalar la PWA');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error al mostrar prompt de instalación:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // No mostrar de nuevo en esta sesión
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // No mostrar si ya está instalada o si se rechazó recientemente
  if (isInstalled || !deferredPrompt) {
    return null;
  }

  // Verificar si se rechazó recientemente (últimas 24 horas)
  const lastDismissed = localStorage.getItem('pwa-prompt-dismissed');
  if (lastDismissed) {
    const timeSince = Date.now() - parseInt(lastDismissed);
    if (timeSince < 24 * 60 * 60 * 1000) { // 24 horas
      return null;
    }
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Smartphone className="text-white" size={20} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold text-sm mb-1">
                  ¡Instala Se7en!
                </h4>
                <p className="text-gray-400 text-xs mb-3 leading-relaxed">
                  Agrega Se7en a tu pantalla de inicio para acceso rápido y una experiencia como app nativa.
                </p>
                
                <div className="flex space-x-2">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[36px]"
                  >
                    <Download size={14} />
                    <span>Instalar</span>
                  </button>
                  
                  <button
                    onClick={handleDismiss}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg text-xs transition-colors touch-manipulation min-h-[36px] flex items-center justify-center"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white transition-colors p-1 touch-manipulation"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 