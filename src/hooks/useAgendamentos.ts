import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';

export interface Agendamento {
  id?: string;
  userId: string;
  barberId: string;
  dateStr: string;
  timeSlots: string[];
  service: string;
  duration: number;
  name?: string;
  email?: string;
  barber?: string;
  status: 'confirmado' | 'cancelado' | 'concluido' | 'pendente';
  createdAt?: Date;
}

// Corrigir queries e verificação de nulos

export function useAgendamentos(filtroUserId?: string, filtroBarberId?: string, filtroData?: string) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    async function fetchAgendamentos() {
      try {
        // Construir a query base
        const agendamentosRef = collection(db, 'agendamentos');
        let currentQuery;
        
        // Aplicar filtros
        if (filtroUserId) {
          currentQuery = query(agendamentosRef, where('userId', '==', filtroUserId));
        } else if (filtroBarberId) {
          currentQuery = query(agendamentosRef, where('barberId', '==', filtroBarberId));
        } else if (filtroData) {
          currentQuery = query(agendamentosRef, where('dateStr', '==', filtroData));
        } else {
          // Se não houver filtros específicos, limitar por papel do usuário
          if (user && user.role === 'user') {
            currentQuery = query(agendamentosRef, where('userId', '==', user.uid));
          } else if (user && user.role === 'barber') {
            // Procurar o ID do barbeiro associado ao userId
            const barbeirosRef = collection(db, 'barbeiros');
            const barberQuery = query(barbeirosRef, where('userId', '==', user.uid));
            const barberSnapshot = await getDocs(barberQuery);
            
            if (!barberSnapshot.empty) {
              const barberId = barberSnapshot.docs[0].id;
              currentQuery = query(agendamentosRef, where('barberId', '==', barberId));
            } else {
              currentQuery = query(agendamentosRef); // Query vazia, não mostrar nada
            }
          } else {
            // Para admin ou caso não identificado, mostra todos os agendamentos
            currentQuery = query(agendamentosRef);
          }
        }
        
        const snapshot = await getDocs(currentQuery);
        const agendamentosData = await Promise.all(snapshot.docs.map(async docSnapshot => {
          const data = docSnapshot.data();
          
          // Enriquecer com nome do barbeiro se não estiver presente
          let barberName = data.barber;
          if (!barberName && data.barberId) {
            try {
              const barbeiroDoc = await getDoc(doc(db, 'barbeiros', data.barberId));
              if (barbeiroDoc.exists()) {
                barberName = barbeiroDoc.data().name;
              }
            } catch (error) {
              console.error('Erro ao buscar dados do barbeiro:', error);
            }
          }
          
          // Enriquecer com nome do usuário se não estiver presente
          let userName = data.name;
          let userEmail = data.email;
          if ((!userName || !userEmail) && data.userId) {
            try {
              const userDoc = await getDoc(doc(db, 'usuarios', data.userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                userName = userData.name || userName;
                userEmail = userData.email || userEmail;
              }
            } catch (error) {
              console.error('Erro ao buscar dados do usuário:', error);
            }
          }
          
          return {
            id: docSnapshot.id,
            ...data,
            barber: barberName || 'Barbeiro não encontrado',
            name: userName || 'Cliente não encontrado',
            email: userEmail || 'Email não encontrado'
          } as Agendamento;
        }));
        
        setAgendamentos(agendamentosData);
        setError(null);
      } catch (err: any) {
        console.error('Erro ao buscar agendamentos:', err);
        setError('Falha ao carregar agendamentos: ' + (err.message || 'Erro desconhecido'));
      } finally {
        setLoading(false);
      }
    }
    
    fetchAgendamentos();
  }, [user, filtroUserId, filtroBarberId, filtroData]);
  
  async function criarAgendamento(dados: Omit<Agendamento, 'id'>) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      // Adicionar timestamp de criação
      const dadosCompletos = {
        ...dados,
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'agendamentos'), dadosCompletos);
      
      // Atualizar o estado local
      setAgendamentos([...agendamentos, { ...dadosCompletos, id: docRef.id }]);
      
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
      return { success: false, error: 'Falha ao criar agendamento.' };
    }
  }
  
  async function atualizarAgendamento(id: string, dados: Partial<Agendamento>) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      // Verificar permissões
      const agendamento = agendamentos.find(a => a.id === id);
      if (!agendamento) {
        return { success: false, error: 'Agendamento não encontrado.' };
      }
      
      if (user.role !== 'admin' && user.uid !== agendamento.userId) {
        // Verificar se o usuário é o barbeiro deste agendamento
        if (user.role === 'barber') {
          const barberSnapshot = await getDocs(
            query(collection(db, 'barbeiros'), where('userId', '==', user.uid))
          );
          
          if (barberSnapshot.empty || barberSnapshot.docs[0].id !== agendamento.barberId) {
            return { success: false, error: 'Permissão negada.' };
          }
        } else {
          return { success: false, error: 'Permissão negada.' };
        }
      }
      
      await updateDoc(doc(db, 'agendamentos', id), dados);
      
      // Atualizar o estado local
      setAgendamentos(
        agendamentos.map(a => a.id === id ? { ...a, ...dados } : a)
      );
      
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar agendamento:', err);
      return { success: false, error: 'Falha ao atualizar agendamento.' };
    }
  }
  
  async function excluirAgendamento(id: string) {
    try {
      if (!user) {
        return { success: false, error: 'Usuário não autenticado.' };
      }
      
      // Verificar permissões
      const agendamento = agendamentos.find(a => a.id === id);
      if (!agendamento) {
        return { success: false, error: 'Agendamento não encontrado.' };
      }
      
      if (user.role !== 'admin' && user.uid !== agendamento.userId) {
        return { success: false, error: 'Permissão negada.' };
      }
      
      await deleteDoc(doc(db, 'agendamentos', id));
      
      // Atualizar o estado local
      setAgendamentos(agendamentos.filter(a => a.id !== id));
      
      return { success: true };
    } catch (err) {
      console.error('Erro ao excluir agendamento:', err);
      return { success: false, error: 'Falha ao excluir agendamento.' };
    }
  }
  
  return {
    agendamentos,
    loading,
    error,
    criarAgendamento,
    atualizarAgendamento,
    excluirAgendamento
  };
}