"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Define uma interface que estende o tipo User com a propriedade role (e outras se necessário)
export interface ExtendedUser extends User {
  role?: string;
  // Você pode adicionar outras propriedades personalizadas aqui
}

interface AuthState {
  user: ExtendedUser | null;
  loading: boolean;
  error: Error | null;
}

const useAuth = (): AuthState => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (currentUser) {
          // Busca os dados adicionais do usuário no Firestore (na coleção "usuarios")
          const userDocRef = doc(db, "usuarios", currentUser.uid);
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              // Combina os dados do currentUser com os dados do Firestore
              setUser({ ...currentUser, ...userData } as ExtendedUser);
            } else {
              // Caso não exista documento no Firestore, seta apenas o currentUser
              setUser(currentUser as ExtendedUser);
            }
          } catch (err) {
            console.error("Erro ao buscar dados adicionais do usuário:", err);
            setUser(currentUser as ExtendedUser);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { user, loading, error };
};

export default useAuth;