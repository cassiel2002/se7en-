import React from 'react';
import { Star, Gift } from 'lucide-react';
import { Cliente } from '../../firebase/firestore';

interface PuntosClienteProps {
  cliente: Cliente;
  className?: string;
}

export const PuntosCliente: React.FC<PuntosClienteProps> = ({ cliente, className = '' }) => {
  const puntosDisponibles = cliente.puntos || 0;
  const puntosCanjeados = cliente.puntosCanjeados || 0;
  const puntosTotal = puntosDisponibles + puntosCanjeados;

  return (
    <div className={`bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg p-4 text-white ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Star className="w-6 h-6" />
          <div>
            <h3 className="font-semibold text-lg">{puntosDisponibles} Puntos</h3>
            <p className="text-sm opacity-90">Disponibles para canjear</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center space-x-1">
            <Gift className="w-4 h-4" />
            <span className="text-sm">{puntosCanjeados} canjeados</span>
          </div>
          <p className="text-xs opacity-75">Total ganados: {puntosTotal}</p>
        </div>
      </div>
      
      {/* Barra de progreso para próximo premio */}
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span>Próximo premio: Corte gratis (10 pts)</span>
          <span>{Math.min(puntosDisponibles, 10)}/10</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${Math.min((puntosDisponibles / 10) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};