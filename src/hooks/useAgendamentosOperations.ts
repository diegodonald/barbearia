import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Agendamento } from '@/types/common';

export function useAgendamentosOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAgendamento = async (data: Omit<Agendamento, 'id'>) => {
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "agendamentos"), {
        ...data,
        createdAt: data.createdAt || new Date()
      });
      setLoading(false);
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
      setError('Falha ao criar agendamento.');
      setLoading(false);
      return { success: false, error: 'Falha ao criar agendamento' };
    }
  };

  const updateAgendamento = async (id: string, data: Partial<Agendamento>) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "agendamentos", id), data);
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar agendamento:', err);
      setError('Falha ao atualizar agendamento.');
      setLoading(false);
      return { success: false, error: 'Falha ao atualizar agendamento' };
    }
  };

  const deleteAgendamento = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, "agendamentos", id));
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir agendamento:', err);
      setError('Falha ao excluir agendamento.');
      setLoading(false);
      return { success: false, error: 'Falha ao excluir agendamento' };
    }
  };

  return { 
    createAgendamento, 
    updateAgendamento, 
    deleteAgendamento, 
    loading, 
    error 
  };
}