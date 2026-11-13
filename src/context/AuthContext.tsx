import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, normalizeProfile } from '../firebase/auth';
import { getFriendlyErrorMessage } from '../utils/firebaseErrors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Error al cargar el perfil (sin conexión, cuota, permisos...). */
  profileError: string | null;
  /** Reintenta cargar el perfil del usuario autenticado. */
  retryProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (currentUser: User) => {
    try {
      const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (profileDoc.exists()) {
        setProfile(normalizeProfile(currentUser.uid, profileDoc.data()));
        setProfileError(null);
      } else {
        console.warn('AuthContext: el usuario no tiene documento de perfil:', currentUser.uid);
        setProfile(null);
        setProfileError(getFriendlyErrorMessage({ code: 'app/profile-not-found' }));
      }
    } catch (error) {
      console.error('AuthContext: error cargando perfil:', error);
      setProfile(null);
      setProfileError(getFriendlyErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser);
      } else {
        setProfile(null);
        setProfileError(null);
      }
      setLoading(false);
    });

    return unsubscribeAuth;
  }, [loadProfile]);

  const retryProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    await loadProfile(auth.currentUser);
    setLoading(false);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, retryProfile }}>
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
