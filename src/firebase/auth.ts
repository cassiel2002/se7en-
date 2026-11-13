import {
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'cajero' | 'cashier';
  createdAt: Date;
  // Campos para encargado
  isEncargado?: boolean;         // Si es encargado
  plusEncargado?: number;        // Monto diario automático
  plusEncargadoActivo?: boolean; // Si el plus automático está activo
}

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

    if (!userDoc.exists()) {
      throw new Error('Usuario no encontrado en la base de datos');
    }

    return {
      user: userCredential.user,
      profile: userDoc.data() as UserProfile
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const initializeDefaultUsers = async () => {
  console.log('🚀 Inicializando usuarios por defecto...');
  console.log('');
  console.log('📋 USUARIOS PARA REGISTRAR EN FIREBASE:');
  console.log('=====================================');
  console.log('');
  console.log('👨‍💼 ADMINISTRADOR:');
  console.log('  📧 Email: admin@se7en.com');
  console.log('  🔑 Password: admin123');
  console.log('  👤 Nombre: Administrador Se7en');
  console.log('  🛡️ Rol: admin');
  console.log('');
  console.log('👨‍💻 CAJERO 1:');
  console.log('  📧 Email: cajero1@se7en.com');
  console.log('  🔑 Password: cajero123');
  console.log('  👤 Nombre: Carlos Mendez');
  console.log('  🛡️ Rol: cajero');
  console.log('');
  console.log('👨‍💻 CAJERO 2 - LEANDRO:');
  console.log('  📧 Email: leorb@seven.com');
  console.log('  🔑 Password: leandro rb');
  console.log('  👤 Nombre: LeoRB');
  console.log('  🛡️ Rol: cashier');
  console.log('');
  console.log('💡 Registra estos usuarios manualmente en Firebase Auth y Firestore');
  console.log('📁 Colección: users');
  console.log('🆔 Document ID: usar el UID de Firebase Auth');
  console.log('');
};