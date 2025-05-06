import { useState, useEffect } from 'react';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';

export interface Servico {
  id: string;
  name: string;
  duration: number;
  value: number;
}

export function useServicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchServicos() {
      try {
        const snapshot = await getDocs(collection(db, 'servicos'));
        const servicosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Servico[];
        
        setServicos(servicosData);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar serviços:', err);
        setError('Falha ao carregar serviços.');
      } finally {
        setLoading(false);
      }
    }

    fetchServicos();
  }, []);

  async function criarServico(dados: Omit<Servico, 'id'>) {
    try {
      if (!user || user.role !== 'admin') {
        return { success: false, error: 'Permissão negada.' };
      }
      
      const docRef = await addDoc(collection(db, 'servicos'), dados);
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erro ao criar serviço:', err);
      return { success: false, error: 'Falha ao criar serviço.' };
    }
  }

  async function atualizarServico(id: string, dados: Partial<Servico>) {
    try {
      if (!user || user.role !== 'admin') {
        return { success: false, error: 'Permissão negada.' };
      }
      
      await updateDoc(doc(db, 'servicos', id), dados);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar serviço:', err);
      return { success: false, error: 'Falha ao atualizar serviço.' };
    }
  }

  async function excluirServico(id: string) {
    try {
      if (!user || user.role !== 'admin') {
        return { success: false, error: 'Permissão negada.' };
      }
      
      await deleteDoc(doc(db, 'servicos', id));
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir serviço:', err);
      return { success: false, error: 'Falha ao excluir serviço.' };
    }
  }

  return { 
    servicos, 
    loading, 
    error,
    criarServico,
    atualizarServico,
    excluirServico
  };
}