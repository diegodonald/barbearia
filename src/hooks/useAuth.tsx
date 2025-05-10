'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Definição da interface para o usuário com informações extras
export interface ExtendedUser {
  uid: string;
  email: string | null;
  role?: 'admin' | 'barber' | 'user';
  name?: string;
}

interface AuthContextType {
  user: ExtendedUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Garante que só executamos no cliente
    if (typeof window === 'undefined') return;

    console.log('AuthProvider: Iniciando verificação de autenticação');
    let isMounted = true;

    // Configura um timeout global que será limpo se o auth resolver antes
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.log('AuthProvider: Timeout acionado, finalizando estado de carregamento');
        setLoading(false);
      }
    }, 3000);

    // Verifica se já temos um usuário no auth.currentUser logo no início
    const checkInitialUser = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          console.log('AuthProvider: Já existe um usuário logado:', currentUser.uid);

          // Buscar dados adicionais do usuário
          const userDocRef = doc(db, 'usuarios', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists() && isMounted) {
            const userData = userDoc.data();
            setUser({
              uid: currentUser.uid,
              email: currentUser.email,
              role: userData.role || 'user',
              name: userData.name,
            });
          } else if (isMounted) {
            setUser({
              uid: currentUser.uid,
              email: currentUser.email,
              role: 'user',
            });
          }

          if (isMounted) setLoading(false);
        }
      } catch (err) {
        console.error('Erro na verificação inicial:', err);
      }

      setAuthInitialized(true);
    };

    // Executa verificação inicial antes do onAuthStateChanged
    checkInitialUser();

    // Configura o listener para mudanças futuras
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (!isMounted) return;

      try {
        console.log('AuthProvider: Estado de auth alterado', firebaseUser?.uid);

        if (firebaseUser) {
          // Busca dados adicionais do usuário
          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists() && isMounted) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: userData.role || 'user',
              name: userData.name,
            });
          } else if (isMounted) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'user',
            });
          }
        } else if (isMounted) {
          setUser(null);
        }
      } catch (err) {
        console.error('AuthProvider: Erro ao autenticar usuário:', err);
        if (isMounted) setError('Falha ao carregar dados do usuário.');
      } finally {
        if (isMounted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
      console.log('AuthProvider: Limpeza concluída');
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('AuthProvider: Iniciando logout');
      await firebaseSignOut(auth);
      setUser(null);
      console.log('AuthProvider: Logout bem-sucedido');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      setError('Falha ao fazer logout.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export default function useAuth() {
  return useContext(AuthContext);
}
