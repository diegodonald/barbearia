'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OperatingHours, Exception } from '@/types/schedule';

export function useOperatingHours(targetId: string = 'global') {
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar horários e exceções
  useEffect(() => {
    if (!targetId) return;

    async function fetchData() {
      setLoading(true);
      try {
        console.log('Buscando horários para:', targetId);

        // Buscar horários da nova estrutura
        const horariosDocRef = doc(db, 'horarios', targetId);
        const horariosSnapshot = await getDoc(horariosDocRef);

        if (horariosSnapshot.exists()) {
          console.log('Horários encontrados na nova estrutura');
          setOperatingHours(horariosSnapshot.data() as OperatingHours);
        } else {
          console.log('Nenhum horário encontrado para:', targetId);
          // Carregar configuração padrão se não existir
          setOperatingHours({
            domingo: { active: false },
            segunda: { active: true, open: '08:00', close: '18:00' },
            terça: { active: true, open: '08:00', close: '18:00' },
            quarta: { active: true, open: '08:00', close: '18:00' },
            quinta: { active: true, open: '08:00', close: '18:00' },
            sexta: { active: true, open: '08:00', close: '18:00' },
            sábado: { active: true, open: '08:00', close: '13:00' },
          });
        }

        // Buscar exceções da nova estrutura
        try {
          console.log('Buscando exceções para:', targetId);
          const exceptionsList: Exception[] = [];
          const excecoesRef = collection(db, 'excecoes', targetId, 'datas');
          const excecoesSnapshot = await getDocs(excecoesRef);

          excecoesSnapshot.forEach(doc => {
            exceptionsList.push({
              id: doc.id,
              ...(doc.data() as Exception),
            });
          });

          setExceptions(exceptionsList);
        } catch (excErr) {
          console.error('Erro ao buscar exceções:', excErr);
          // Não falhar completamente se houver erro apenas nas exceções
        }
      } catch (err) {
        console.error('Erro ao buscar dados de horários:', err);
        setError('Falha ao carregar configurações');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [targetId]);

  // Função para salvar horários
  const saveOperatingHours = async (newHours: OperatingHours): Promise<boolean> => {
    if (!targetId) return false;

    try {
      console.log('Salvando horários para:', targetId);
      await setDoc(doc(db, 'horarios', targetId), newHours);
      setOperatingHours(newHours);
      return true;
    } catch (err) {
      console.error('Erro ao salvar horários:', err);
      return false;
    }
  };

  // Função para salvar uma exceção
  const saveException = async (exception: Exception): Promise<boolean> => {
    if (!targetId || !exception.date) return false;

    try {
      console.log('Salvando exceção para:', targetId, 'data:', exception.date);
      await setDoc(doc(db, 'excecoes', targetId, 'datas', exception.date), exception);

      // Atualizar o estado local
      setExceptions(prev => {
        const filtered = prev.filter(ex => ex.date !== exception.date);
        return [...filtered, { ...exception, id: exception.date }];
      });

      return true;
    } catch (err) {
      console.error('Erro ao salvar exceção:', err);
      return false;
    }
  };

  return {
    operatingHours,
    exceptions,
    loading,
    error,
    saveOperatingHours,
    saveException,
  };
}
