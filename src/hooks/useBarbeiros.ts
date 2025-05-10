'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Barbeiro {
  id: string;
  name: string;
  email?: string;
  role: string;
  // Outros campos que possam existir
}

export function useBarbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBarbeiros() {
      try {
        setLoading(true);
        console.log('Buscando barbeiros...');

        // Query a coleção 'usuarios' onde role=barber
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, where('role', '==', 'barber'));

        try {
          const querySnapshot = await getDocs(q);
          console.log('Total de barbeiros encontrados:', querySnapshot.size);

          const barbers: Barbeiro[] = [];
          querySnapshot.forEach(doc => {
            const data = doc.data();
            console.log('Barbeiro encontrado:', doc.id);
            barbers.push({
              id: doc.id,
              name: data.name || 'Nome não encontrado',
              role: data.role || 'barber',
              email: data.email,
              ...data,
            });
          });

          setBarbeiros(barbers);
          setError(null);
        } catch (queryErr: any) {
          console.error('Erro na consulta de barbeiros:', queryErr);
          throw queryErr;
        }
      } catch (err: any) {
        console.error('Erro ao buscar barbeiros:', err);
        setError(err.message || 'Erro desconhecido ao buscar barbeiros');
        setBarbeiros([]); // Garantir que o array esteja vazio em caso de erro
      } finally {
        setLoading(false);
      }
    }

    fetchBarbeiros();
  }, []);

  return { barbeiros, loading, error };
}
