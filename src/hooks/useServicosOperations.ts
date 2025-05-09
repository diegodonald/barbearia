import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Servico } from '@/hooks/useServicos';

export function useServicosOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createServico = async (data: Omit<Servico, 'id'>) => {
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "servicos"), data);
      setLoading(false);
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erro ao criar serviço:', err);
      setError('Falha ao criar serviço.');
      setLoading(false);
      return { success: false, error: 'Falha ao criar serviço' };
    }
  };

  const updateServico = async (id: string, data: Partial<Servico>) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "servicos", id), data);
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar serviço:', err);
      setError('Falha ao atualizar serviço.');
      setLoading(false);
      return { success: false, error: 'Falha ao atualizar serviço' };
    }
  };

  const deleteServico = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, "servicos", id));
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir serviço:', err);
      setError('Falha ao excluir serviço.');
      setLoading(false);
      return { success: false, error: 'Falha ao excluir serviço' };
    }
  };

  return { createServico, updateServico, deleteServico, loading, error };
}