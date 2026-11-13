import { createPremio } from './firestore';

export const initializePremios = async () => {
  try {
    console.log('🎁 Inicializando premios...');
    
    const premiosIniciales = [
      {
        nombre: 'Corte Gratis',
        descripcion: 'Un corte de cabello completamente gratis',
        puntosRequeridos: 10,
        activo: true,
        tipo: 'servicio_gratis' as const
      },
      {
        nombre: 'Tattoo Mínimo',
        descripcion: 'Tatuaje pequeño o diseño mínimo gratis',
        puntosRequeridos: 20,
        activo: true,
        tipo: 'servicio_gratis' as const
      },
      {
        nombre: 'Perfume',
        descripcion: 'Perfume de regalo',
        puntosRequeridos: 25,
        activo: true,
        tipo: 'producto' as const
      },
      {
        nombre: '50% OFF en Tattoo',
        descripcion: '50% de descuento en cualquier tatuaje',
        puntosRequeridos: 30,
        activo: true,
        tipo: 'descuento' as const,
        valor: 50
      }
    ];

    for (const premio of premiosIniciales) {
      await createPremio(premio);
      console.log(`✅ Premio creado: ${premio.nombre}`);
    }
    
    console.log('🎉 Premios inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando premios:', error);
  }
};