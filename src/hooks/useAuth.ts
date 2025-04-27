// src/hooks/useAuth.ts

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const useAuth = () => {
  // Estado para armazenar o usuário atual (se estiver autenticado)
  const [user, setUser] = useState<User | null>(null);
  // Estado para indicar se a autenticação ainda está carregando
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Registra a função de callback para ouvir alterações no estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    // Retorna uma função de limpeza para cancelar a inscrição quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  // Retorna o usuário e o estado de carregamento
  return { user, loading };
};

export default useAuth;
