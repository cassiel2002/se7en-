import { getDocs, collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Script para limpiar premios duplicados
export const cleanDuplicatePremios = async () => {
  try {
    console.log('🧹 Limpiando premios duplicados...');
    
    const querySnapshot = await getDocs(collection(db, 'premios'));
    const premios: any[] = [];
    const premiosMap = new Map();
    
    // Recopilar todos los premios
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const premio = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      };
      premios.push(premio);
    });
    
    console.log(`📊 Total de premios encontrados: ${premios.length}`);
    
    // Agrupar por nombre para encontrar duplicados
    premios.forEach(premio => {
      const key = premio.nombre.toLowerCase().trim();
      if (!premiosMap.has(key)) {
        premiosMap.set(key, []);
      }
      premiosMap.get(key).push(premio);
    });
    
    // Eliminar duplicados (mantener el más reciente)
    let eliminados = 0;
    for (const [nombre, premiosGrupo] of premiosMap.entries()) {
      if (premiosGrupo.length > 1) {
        console.log(`🔍 Encontrados ${premiosGrupo.length} duplicados para: ${nombre}`);
        
        // Ordenar por fecha de creación (más reciente primero)
        premiosGrupo.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
        
        // Eliminar todos excepto el primero (más reciente)
        for (let i = 1; i < premiosGrupo.length; i++) {
          const premioAEliminar = premiosGrupo[i];
          console.log(`🗑️ Eliminando duplicado: ${premioAEliminar.id}`);
          await deleteDoc(doc(db, 'premios', premioAEliminar.id));
          eliminados++;
        }
      }
    }
    
    console.log(`✅ Limpieza completada. Eliminados: ${eliminados} premios duplicados`);
    return { eliminados, total: premios.length };
    
  } catch (error) {
    console.error('❌ Error limpiando premios duplicados:', error);
    throw error;
  }
};

// Función para eliminar TODOS los premios (usar con cuidado)
export const deleteAllPremios = async () => {
  try {
    const confirmDelete = confirm('⚠️ ¿ESTÁS SEGURO? Esto eliminará TODOS los premios. Esta acción no se puede deshacer.');
    if (!confirmDelete) return;
    
    console.log('🗑️ Eliminando todos los premios...');
    
    const querySnapshot = await getDocs(collection(db, 'premios'));
    let eliminados = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      await deleteDoc(doc(db, 'premios', docSnapshot.id));
      eliminados++;
      console.log(`🗑️ Eliminado premio: ${docSnapshot.id}`);
    }
    
    console.log(`✅ Eliminados ${eliminados} premios`);
    return eliminados;
    
  } catch (error) {
    console.error('❌ Error eliminando premios:', error);
    throw error;
  }
};

// Hacer disponible en la consola del navegador
if (typeof window !== 'undefined') {
  (window as any).cleanDuplicatePremios = cleanDuplicatePremios;
  (window as any).deleteAllPremios = deleteAllPremios;
}