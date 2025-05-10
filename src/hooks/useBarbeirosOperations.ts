import { useState } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OperatingHours, Exception } from '@/types/common';

export function useBarbeirosOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para atualizar os horários de um barbeiro
  const updateBarbeiroHorarios = async (barberId: string, horarios: OperatingHours) => {
    setLoading(true);
    try {
      // Salvar na coleção horarios
      await setDoc(doc(db, 'horarios', barberId), horarios);
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar horários do barbeiro:', err);
      setError('Falha ao atualizar horários.');
      setLoading(false);
      return { success: false, error: 'Falha ao atualizar horários' };
    }
  };

  // Para adicionar uma exceção
  const addBarbeiroException = async (barberId: string, exception: Omit<Exception, 'id'>) => {
    setLoading(true);
    try {
      console.log(`Adicionando exceção para barbeiro ${barberId}: `, exception);

      // Garantir que a coleção exista - fazer isso de forma incremental evita erros de permissão
      const excecoesRef = collection(db, 'excecoes');
      const barbeiroExcecoesRef = doc(excecoesRef, barberId);

      // Primeiro verificar se o documento existe
      const barbeiroExcecoesSnap = await getDoc(barbeiroExcecoesRef);

      // Se não existir, criar um documento vazio
      if (!barbeiroExcecoesSnap.exists()) {
        await setDoc(barbeiroExcecoesRef, {});
        console.log(`Documento base criado em excecoes/${barberId}`);
      }

      // Agora adicionar a exceção na subcoleção datas
      const dataId = exception.date; // Usar a data como ID
      const exceptionDocRef = doc(collection(db, 'excecoes', barberId, 'datas'), dataId);

      await setDoc(exceptionDocRef, exception);
      console.log(`Exceção criada com sucesso: ${dataId}`);

      setLoading(false);
      return { success: true, id: dataId };
    } catch (err) {
      console.error('Erro ao adicionar exceção:', err);
      setError('Falha ao adicionar exceção.');
      setLoading(false);
      return { success: false, error: 'Falha ao adicionar exceção' };
    }
  };

  // Função para deletar uma exceção de horário
  const deleteBarbeiroException = async (barberId: string, exceptionId: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'excecoes', barberId, 'datas', exceptionId));
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir exceção:', err);
      setError('Falha ao excluir exceção.');
      setLoading(false);
      return { success: false, error: 'Falha ao excluir exceção' };
    }
  };

  return {
    updateBarbeiroHorarios,
    addBarbeiroException,
    deleteBarbeiroException,
    loading,
    error,
  };
}
