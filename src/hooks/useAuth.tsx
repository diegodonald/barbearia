'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { OperatingHours, Exception } from '@/types/common';

// Definição da interface para o usuário com informações extras
export interface ExtendedUser {
  uid: string;
  email: string | null;
  role?: 'admin' | 'barber' | 'user';
  name?: string;
  horarios?: OperatingHours;
  exceptions?: Exception[];
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

  useEffect(() => {
    console.log('AuthProvider: Iniciando listener de autenticação');

    // Enforce immediate auth check
    const currentUser = auth.currentUser;
    console.log('Auth current user on mount:', currentUser?.uid);

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      try {
        console.log('AuthProvider: Estado de auth alterado', firebaseUser?.uid);

        if (firebaseUser) {
          // Busca dados adicionais do usuário
          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('AuthProvider: Dados do usuário encontrados', userData);

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: userData.role || 'user',
              name: userData.name,
              horarios: userData.horarios,
              exceptions: userData.exceptions || [],
            });
          } else {
            console.log('AuthProvider: Dados do usuário não encontrados, usando info básica');
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'user',
            });
          }
        } else {
          console.log('AuthProvider: Nenhum usuário Firebase');
          setUser(null);
        }
      } catch (err) {
        console.error('AuthProvider: Erro ao autenticar usuário:', err);
        setError('Falha ao carregar dados do usuário.');
      } finally {
        console.log('AuthProvider: Definindo loading como false');
        setLoading(false);
      }
    });

    // Garante que o estado de carregamento seja definido como false após um tempo
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('AuthProvider: Forçando loading como false após timeout');
        setLoading(false);
      }
    }, 5000);

    return () => {
      console.log('AuthProvider: Cancelando listener de auth');
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [loading]); // ← Adicionar loading como dependência

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

  console.log('AuthProvider render:', { user, loading, error });

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export default function useAuth() {
  return useContext(AuthContext);
}
