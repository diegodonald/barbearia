import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { ExtendedUser } from '@/types/common';

export interface Barbeiro {
  id: string;
  name: string;
  horarios?: any;
  exceptions?: any[];
}

export function useBarbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Buscar da coleção "barbeiros" em vez de "usuarios"
      const q = query(collection(db, "barbeiros"), where("active", "==", true));
      
      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        // Array para armazenar os barbeiros com dados enriquecidos
        const barbeirosPromises = querySnapshot.docs.map(async (doc) => {
          const barberData = doc.data();
          const barberId = doc.id;
          
          // Buscar informações adicionais do usuário
          const userDocRef = doc(db, "usuarios", barberId);
          const userDocSnap = await getDoc(userDocRef);
          const userData = userDocSnap.exists() ? userDocSnap.data() : {};
          
          // Buscar horários específicos na coleção horarios
          const horariosRef = doc(db, "horarios", barberId);
          const horariosSnap = await getDoc(horariosRef);
          const horarios = horariosSnap.exists() ? horariosSnap.data() : null;
          
          // Buscar exceções
          const excecoesRef = collection(db, "excecoes", barberId, "datas");
          const excecoesSnap = await getDocs(excecoesRef);
          const exceptions = excecoesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          return {
            id: barberId,
            name: barberData.name || userData.name || "Barbeiro sem nome",
            horarios: horarios,
            exceptions: exceptions
          };
        });
        
        const barbeirosData = await Promise.all(barbeirosPromises);
        setBarbeiros(barbeirosData);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao buscar barbeiros:", err);
        setError("Não foi possível carregar a lista de barbeiros.");
        setLoading(false);
      });
      
      return () => unsubscribe();
    } catch (err) {
      console.error("Erro ao configurar listener de barbeiros:", err);
      setError("Erro ao configurar busca de barbeiros.");
      setLoading(false);
    }
  }, [user]);

  return { barbeiros, loading, error };
}