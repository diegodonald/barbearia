import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { DayConfig, OperatingHours, Exception } from '@/types/common';

export function useOperatingHours(barberId?: string) {
  const [horarios, setHorarios] = useState<OperatingHours | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchOperatingHours() {
      try {
        let horariosDocRef;
        let exceptionsCollectionRef;
        
        if (barberId) {
          // Buscar horários de um barbeiro específico
          horariosDocRef = doc(db, 'horarios', barberId);
          exceptionsCollectionRef = collection(db, 'excecoes', barberId, 'datas');
        } else {
          // Buscar horários globais
          horariosDocRef = doc(db, 'configuracoes', 'horarios');
          exceptionsCollectionRef = collection(db, 'configuracoes', 'excecoes', 'datas');
        }
        
        const docSnap = await getDoc(horariosDocRef);
        
        if (docSnap.exists()) {
          setHorarios(docSnap.data() as OperatingHours);
        } else {
          // Se não encontrar horários específicos ou globais, criar um padrão vazio
          setHorarios({
            domingo: { active: false },
            segunda: { active: true, open: '08:00', close: '18:00' },
            terça: { active: true, open: '08:00', close: '18:00' },
            quarta: { active: true, open: '08:00', close: '18:00' },
            quinta: { active: true, open: '08:00', close: '18:00' },
            sexta: { active: true, open: '08:00', close: '18:00' },
            sábado: { active: true, open: '08:00', close: '14:00' }
          });
        }
        
        // Buscar exceções
        const exceptionsSnapshot = await getDocs(exceptionsCollectionRef);
        const exceptionsData = exceptionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Exception[];
        
        setExceptions(exceptionsData);
        setError(null);
      } catch (err) {
        console.error('Erro ao carregar horários:', err);
        setError('Falha ao carregar horários de funcionamento.');
      } finally {
        setLoading(false);
      }
    }

    fetchOperatingHours();
  }, [barberId]);

  async function updateHorarios(newHorarios: OperatingHours) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      if (barberId && user.role !== 'admin' && (!user.uid || user.uid !== barberId)) {
        return { success: false, error: 'Permissão negada.' };
      }
      
      const docRef = barberId 
        ? doc(db, 'horarios', barberId)
        : doc(db, 'configuracoes', 'horarios');
      
      await setDoc(docRef, newHorarios);
      setHorarios(newHorarios);
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar horários:', err);
      return { success: false, error: 'Falha ao atualizar horários.' };
    }
  }

  async function addException(exception: Omit<Exception, 'id'>) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      if (barberId && user.role !== 'admin' && user.uid !== barberId) {
        return { success: false, error: 'Permissão negada.' };
      }
      
      const collectionRef = barberId 
        ? collection(db, 'excecoes', barberId, 'datas')
        : collection(db, 'configuracoes', 'excecoes', 'datas');
      
      // Usar a data como ID do documento
      await setDoc(doc(collectionRef, exception.date), exception);
      
      // Atualizar o estado local
      setExceptions([...exceptions, { ...exception, id: exception.date }]);
      return { success: true };
    } catch (err) {
      console.error('Erro ao adicionar exceção:', err);
      return { success: false, error: 'Falha ao adicionar exceção.' };
    }
  }

  async function updateException(id: string, data: Partial<Exception>) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      if (barberId && user.role !== 'admin' && user.uid !== barberId) {
        return { success: false, error: 'Permissão negada.' };
      }
      
      const docRef = barberId 
        ? doc(db, 'excecoes', barberId, 'datas', id)
        : doc(db, 'configuracoes', 'excecoes', 'datas', id);
      
      await updateDoc(docRef, data);
      
      // Atualizar o estado local
      setExceptions(
        exceptions.map(exc => exc.id === id ? { ...exc, ...data } : exc)
      );
      
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar exceção:', err);
      return { success: false, error: 'Falha ao atualizar exceção.' };
    }
  }

  async function deleteException(id: string) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      if (barberId && user.role !== 'admin' && user.uid !== barberId) {
        return { success: false, error: 'Permissão negada.' };
      }
      
      const docRef = barberId 
        ? doc(db, 'excecoes', barberId, 'datas', id)
        : doc(db, 'configuracoes', 'excecoes', 'datas', id);
      
      await deleteDoc(docRef);
      
      // Atualizar o estado local
      setExceptions(exceptions.filter(exc => exc.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir exceção:', err);
      return { success: false, error: 'Falha ao excluir exceção.' };
    }
  }

  return {
    operatingHours: horarios,  // Mudar "horarios" para "operatingHours"
    exceptions,
    loading,
    error,
    updateHorarios,
    addException,
    updateException,
    deleteException
  };
}