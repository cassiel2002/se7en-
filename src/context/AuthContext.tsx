import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { UserProfile } from '../firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext useEffect: Iniciando');
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log('AuthContext: onAuthStateChanged - currentUser:', currentUser?.email);
      setUser(currentUser);

      if (currentUser) {
        console.log('AuthContext: currentUser existe. Intentando cargar perfil para UID:', currentUser.uid);
        try {
          const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (profileDoc.exists()) {
            const userProfileData = { uid: currentUser.uid, ...profileDoc.data() } as UserProfile;
            console.log('AuthContext: Perfil cargado exitosamente:', userProfileData);
            setProfile(userProfileData);
          } else {
            console.warn('AuthContext: No se encontró el documento de perfil para UID:', currentUser.uid);
            setProfile(null); // Asegurarse de que el perfil es null si no se encuentra
          }
        } catch (error) {
          console.error('AuthContext: Error cargando perfil:', error);
          setProfile(null); // Asegurarse de que el perfil es null en caso de error
        }
      } else {
        console.log('AuthContext: No hay currentUser, limpiando perfil.');
        setProfile(null);
      }
      setLoading(false);
      console.log('AuthContext useEffect: Finalizado.');
    });

    return () => {
      console.log('AuthContext useEffect: Desuscribiendo onAuthStateChanged');
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};