import {
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
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

/**
 * Unifica el rol: históricamente se guardó 'cajero' y 'cashier' para lo mismo.
 * La app usa 'cashier' para el cajero.
 */
export const normalizeProfile = (uid: string, data: DocumentData): UserProfile => ({
  ...(data as UserProfile),
  uid,
  role: data.role === 'cajero' ? 'cashier' : data.role,
});

// Los errores se propagan sin envolver para conservar `error.code`
// (auth/..., resource-exhausted, unavailable, etc.).
export const loginUser = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

  if (!userDoc.exists()) {
    await signOut(auth);
    throw Object.assign(new Error('Usuario sin perfil en la base de datos'), { code: 'app/profile-not-found' });
  }

  return {
    user: userCredential.user,
    profile: normalizeProfile(userCredential.user.uid, userDoc.data())
  };
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};
