import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Settings, Save, Users } from 'lucide-react';
import { getDocs, collection, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const GestionEncargados: React.FC = () => {
  const { profile } = useAuth();
  const [cajeros, setCajeros] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados locales para configuración
  const [configEncargados, setConfigEncargados] = useState<Record<string, {
    isEncargado: boolean;
    plusEncargado: number;
    plusEncargadoActivo: boolean;
  }>>({});

  // Cargar cajeros
  const loadCajeros = async () => {
    setLoading(true);
    try {
      const cajerosQuery = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['cajero', 'cashier']))
      );
      
      const cajerosData = cajerosQuery.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserProfile));
      
      setCajeros(cajerosData);

      // Inicializar configuración local
      const initialConfig: typeof configEncargados = {};
      cajerosData.forEach(cajero => {
        initialConfig[cajero.uid] = {
          isEncargado: cajero.isEncargado || false,
          plusEncargado: cajero.plusEncargado || 0,
          plusEncargadoActivo: cajero.plusEncargadoActivo !== false // true por defecto
        };
      });
      setConfigEncargados(initialConfig);
      
    } catch (error) {
      console.error('Error loading cajeros:', error);
      toast.error('Error cargando cajeros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadCajeros();
    }
  }, [profile]);

  // Guardar configuración
  const handleSaveConfig = async () => {
    setSaving(true);
    let changesMade = 0;
    
    try {
      // Actualizar cada cajero en Firebase
      const updatePromises = Object.entries(configEncargados).map(async ([cajeroId, config]) => {
        const cajeroRef = doc(db, 'users', cajeroId);
        await updateDoc(cajeroRef, {
          isEncargado: config.isEncargado,
          plusEncargado: config.plusEncargado,
          plusEncargadoActivo: config.plusEncargadoActivo
        });
        changesMade++;
      });

      await Promise.all(updatePromises);
      
      toast.success(`Configuración actualizada para ${changesMade} cajeros`);
      
      // Recargar datos
      await loadCajeros();
      
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error guardando configuración');
    } finally {
      setSaving(false);
    }
  };

  // Actualizar configuración local
  const updateConfig = (cajeroId: string, field: keyof typeof configEncargados[string], value: boolean | number) => {
    setConfigEncargados(prev => ({
      ...prev,
      [cajeroId]: {
        ...prev[cajeroId],
        [field]: value
      }
    }));
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-400">Solo el administrador puede acceder a esta página</p>
        </div>
      </div>
    );
  }

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
            <Settings className="mr-3 text-purple-600" size={32} />
            Gestión de Encargados
          </h1>
          <p className="text-gray-400 mt-2">
            Configura qué cajeros son encargados y su plus diario automático
          </p>
        </div>
        
        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Save size={20} />
          <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
        </button>
      </div>

      {/* Información */}
      <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-600/30">
        <h3 className="text-purple-400 font-semibold mb-2">ℹ️ Información Importante</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• <strong>Plus Automático:</strong> Se aplica automáticamente cada día si el cajero es encargado</li>
          <li>• <strong>Adicional al 50%:</strong> El plus se suma a la comisión del 50% que ya reciben</li>
          <li>• <strong>Activación:</strong> Puedes activar/desactivar el plus sin quitar el estatus de encargado</li>
          <li>• <strong>Plus Manual:</strong> Se maneja desde la página de Reportes por fecha específica</li>
        </ul>
      </div>

      {/* Lista de Cajeros */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Users className="mr-2 text-blue-400" size={20} />
            Configuración por Cajero ({cajeros.length})
          </h3>
        </div>

        <div className="p-6">
          {cajeros.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No hay cajeros registrados</p>
          ) : (
            <div className="space-y-4">
              {cajeros.map(cajero => {
                const config = configEncargados[cajero.uid];
                if (!config) return null;

                return (
                  <motion.div
                    key={cajero.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Nombre del cajero */}
                      <div>
                        <h4 className="text-white font-semibold">{cajero.name}</h4>
                        <p className="text-gray-400 text-sm">{cajero.email}</p>
                      </div>

                      {/* Toggle Encargado */}
                      <div className="text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={config.isEncargado}
                              onChange={(e) => updateConfig(cajero.uid, 'isEncargado', e.target.checked)}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              config.isEncargado 
                                ? 'bg-purple-600 border-purple-600' 
                                : 'bg-gray-700 border-gray-600 hover:border-purple-500'
                            }`}>
                              {config.isEncargado && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <span className="ml-2 text-white flex items-center">
                            <Star className="mr-1 text-purple-400" size={16} />
                            Es Encargado
                          </span>
                        </label>
                      </div>

                      {/* Monto Plus */}
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">Plus Diario ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={config.plusEncargado}
                          onChange={(e) => updateConfig(cajero.uid, 'plusEncargado', parseFloat(e.target.value) || 0)}
                          disabled={!config.isEncargado}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:opacity-50"
                          placeholder="0"
                        />
                      </div>

                      {/* Toggle Activo */}
                      <div className="text-center">
                        <label className={`inline-flex items-center ${!config.isEncargado ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={config.plusEncargadoActivo}
                              onChange={(e) => updateConfig(cajero.uid, 'plusEncargadoActivo', e.target.checked)}
                              disabled={!config.isEncargado}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              config.plusEncargadoActivo && config.isEncargado
                                ? 'bg-green-600 border-green-600' 
                                : config.isEncargado
                                ? 'bg-gray-700 border-gray-600 hover:border-green-500'
                                : 'bg-gray-800 border-gray-700'
                            }`}>
                              {config.plusEncargadoActivo && config.isEncargado && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <span className="ml-2 text-white">
                            Plus Activo
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Resumen */}
                    {config.isEncargado && (
                      <div className="mt-3 p-3 bg-purple-900/20 rounded border border-purple-600/30">
                        <p className="text-sm text-purple-300">
                          💰 <strong>Pago diario total:</strong> 50% comisión + ${config.plusEncargadoActivo ? config.plusEncargado.toLocaleString() : 0} plus automático
                          {!config.plusEncargadoActivo && (
                            <span className="ml-2 text-yellow-400">(Plus desactivado)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resumen General */}
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-600/30">
        <h3 className="text-lg font-semibold text-purple-400 mb-4">📊 Resumen General</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Total Cajeros</p>
            <p className="text-xl font-bold text-blue-400">{cajeros.length}</p>
          </div>
          
          <div className="bg-purple-900/30 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Encargados Activos</p>
            <p className="text-xl font-bold text-purple-400">
              {Object.values(configEncargados).filter(c => c.isEncargado && c.plusEncargadoActivo).length}
            </p>
          </div>
          
          <div className="bg-green-900/30 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Plus Diario Total</p>
            <p className="text-xl font-bold text-green-400">
              ${Object.values(configEncargados)
                .filter(c => c.isEncargado && c.plusEncargadoActivo)
                .reduce((sum, c) => sum + c.plusEncargado, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 