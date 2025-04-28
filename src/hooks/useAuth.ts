import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

const useAuth = (): AuthState => {
  // Estado para armazenar o usuário atual (se autenticado)
  const [user, setUser] = useState<User | null>(null);
  // Estado para indicar se a autenticação ainda está carregando
  const [loading, setLoading] = useState(true);
  // Estado para armazenar possíveis erros na autenticação
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Registra a função de callback para ouvir alterações no estado de autenticação
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    // Retorna uma função de limpeza para cancelar a inscrição quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  // Retorna o usuário, o estado de carregamento e eventuais erros
  return { user, loading, error };
};

export default useAuth;