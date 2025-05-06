import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Barbeiro {
  id: string;
  name: string;
  userId: string;
  active: boolean;
}

export interface DayConfig {
  open?: string;
  close?: string;
  breakStart?: string;
  breakEnd?: string;
  active: boolean;
}

export interface Horarios {
  domingo?: DayConfig;
  segunda?: DayConfig;
  terça?: DayConfig;
  quarta?: DayConfig;
  quinta?: DayConfig;
  sexta?: DayConfig;
  sábado?: DayConfig;
}

export interface Exception {
  date: string;
  status: 'blocked' | 'available';
  message?: string;
  open?: string;
  close?: string;
  breakStart?: string;
  breakEnd?: string;
}

export function useBarbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBarbeiros() {
      try {
        const q = query(collection(db, 'barbeiros'), where('active', '==', true));
        const snapshot = await getDocs(q);
        
        const barbeirosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Barbeiro[];
        
        setBarbeiros(barbeirosData);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar barbeiros:', err);
        setError('Falha ao carregar a lista de barbeiros.');
      } finally {
        setLoading(false);
      }
    }

    fetchBarbeiros();
  }, []);

  return { barbeiros, loading, error };
}

export async function getBarbeiroHorarios(barberId: string): Promise<Horarios | null> {
  try {
    // Buscar horários do barbeiro
    const horariosDoc = await getDoc(doc(db, 'horarios', barberId));
    if (!horariosDoc.exists()) {
      // Se não houver horários específicos, buscar os horários globais
      const globalDoc = await getDoc(doc(db, 'configuracoes', 'horarios'));
      if (!globalDoc.exists()) return null;
      return globalDoc.data() as Horarios;
    }
    return horariosDoc.data() as Horarios;
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    return null;
  }
}

// Corrigir a função getBarbeiroExcecoes

export async function getBarbeiroExcecoes(barberId: string): Promise<Exception[]> {
  try {
    const datasRef = collection(db, 'excecoes', barberId, 'datas');
    const snapshot = await getDocs(datasRef);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      // Garantir explicitamente todos os campos necessários da interface Exception
      return {
        id: doc.id,
        date: data.date || '',
        status: (data.status as 'blocked' | 'available') || 'blocked',
        message: data.message,
        open: data.open,
        close: data.close,
        breakStart: data.breakStart,
        breakEnd: data.breakEnd
      };
    });
  } catch (error) {
    console.error('Erro ao buscar exceções:', error);
    return [];
  }
}