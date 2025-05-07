import { useState, useEffect } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { OperatingHours, Exception, DayConfig } from '@/types/common';

// Configuração global padrão
const defaultOperatingHours: OperatingHours = {
  domingo: { active: false },
  segunda: { active: true, open: '08:00', breakStart: '12:00', breakEnd: '13:30', close: '18:00' },
  terça: { active: true, open: '08:00', breakStart: '12:00', breakEnd: '13:30', close: '18:00' },
  quarta: { active: true, open: '08:00', breakStart: '12:00', breakEnd: '13:30', close: '18:00' },
  quinta: { active: true, open: '08:00', breakStart: '12:00', breakEnd: '13:30', close: '18:00' },
  sexta: { active: true, open: '08:00', breakStart: '12:00', breakEnd: '13:30', close: '18:00' },
  sábado: { active: true, open: '08:00', breakStart: '12:00', breakEnd: '13:30', close: '14:00' }
};

export function useOperatingHours(barberId?: string) {
  const { user } = useAuth();
  const [operatingHours, setHorarios] = useState<OperatingHours | null>(null);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Determinar qual documento de horários carregar
    const horariosRef = barberId
      ? doc(db, "horarios", barberId)
      : doc(db, "configuracoes", "horarios");
    
    const fetchHorarios = async () => {
      try {
        const docSnap = await getDoc(horariosRef);
        if (docSnap.exists()) {
          setHorarios(docSnap.data() as OperatingHours);
        } else {
          setHorarios(defaultOperatingHours);
        }
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar horários:', err);
        setError('Falha ao carregar horários.');
        setLoading(false);
      }
    };

    // Carregar exceções (da subcoleção correta)
    const exceptionsRef = barberId
      ? collection(db, "excecoes", barberId, "datas")
      : collection(db, "configuracoes", "excecoes", "datas");
    
    const unsubscribe = onSnapshot(exceptionsRef, (snapshot) => {
      const exceptionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Exception));
      
      setExceptions(exceptionsList);
    }, (err) => {
      console.error('Erro ao carregar exceções:', err);
      setError('Falha ao carregar exceções.');
    });

    fetchHorarios();
    return () => unsubscribe();
  }, [barberId]);

  async function updateHorarios(newHorarios: OperatingHours) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      if (barberId && user.role !== 'admin' && user.uid !== barberId) {
        return { success: false, error: 'Permissão negada.' };
      }
      
      const docRef = barberId
        ? doc(db, "horarios", barberId)
        : doc(db, "configuracoes", "horarios");
      
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
      
      const collRef = barberId
        ? collection(db, 'excecoes', barberId, 'datas')
        : collection(db, 'configuracoes', 'excecoes', 'datas');
      
      // Usar a data como ID
      const docId = exception.date;
      await setDoc(doc(collRef, docId), exception);
      
      setExceptions([...exceptions, { ...exception, id: docId }]);
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
        ? doc(db, 'usuarios', barberId, 'exceptions', id)
        : doc(db, 'configuracoes', 'operatingHours', 'exceptions', id);
      
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
      setExceptions(exceptions.filter(exc => exc.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir exceção:', err);
      return { success: false, error: 'Falha ao excluir exceção.' };
    }
  }

  return { 
    operatingHours, 
    exceptions, 
    loading, 
    error, 
    updateHorarios, 
    addException,
    updateException,
    deleteException
  };
}