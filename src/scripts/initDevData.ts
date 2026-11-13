// Script para inicializar datos de desarrollo
// Ejecutar una sola vez para configurar el sistema de puntos

import { initializePremios } from '../firebase/initPremios';
import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const initDevData = async () => {
  console.log('🚀 Inicializando datos de desarrollo...');
  
  try {
    await initializePremios();
    console.log('✅ Datos de desarrollo inicializados correctamente');
  } catch (error) {
    console.error('❌ Error inicializando datos:', error);
  }
};

export const fixVisitas = async () => {
  console.log('🚀 Corrigiendo visitas basadas en los puntos actuales...');
  try {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    let actualizados = 0;
    
    for (const document of querySnapshot.docs) {
      const data = document.data();
      const puntos = data.puntos || 0;
      const puntosCanjeados = data.puntosCanjeados || 0;
      
      const visitasCorrectas = puntos + puntosCanjeados;
      
      if (data.visitas !== visitasCorrectas) {
        await updateDoc(doc(db, 'clientes', document.id), {
          visitas: visitasCorrectas,
          updatedAt: serverTimestamp()
        });
        actualizados++;
      }
    }
    
    console.log(`✅ Proceso completado. Se actualizaron ${actualizados} clientes.`);
  } catch (error) {
    console.error('❌ Error corrigiendo visitas:', error);
  }
};

// Ejecutar si se llama directamente
if (typeof window !== 'undefined') {
  // Solo en el navegador
  (window as any).initDevData = initDevData;
  (window as any).fixVisitas = fixVisitas;
}