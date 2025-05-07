import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Servico {
  id?: string;
  name: string;
  duration: number;
  value: number;
}

export function useServicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = query(collection(db, "servicos"));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const servicosData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            duration: Number(data.duration),
            value: Number(data.value)
          };
        });
        
        setServicos(servicosData);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao buscar serviços:", err);
        setError("Não foi possível carregar a lista de serviços.");
        setLoading(false);
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error("Erro ao configurar listener de serviços:", err);
      setError("Erro ao configurar busca de serviços.");
      setLoading(false);
    }
  }, []);

  return { servicos, loading, error };
}