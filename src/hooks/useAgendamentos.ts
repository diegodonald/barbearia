import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { ExtendedUser } from '@/types/common'; // Corrigir a importação se necessário

export interface Agendamento {
  id: string;
  dateStr: string;
  timeSlot?: string;
  timeSlots?: string[];
  duration?: number;
  service: string;
  barber: string;
  barberId: string;
  name: string;
  status: string;
  uid: string;
  email?: string;
  createdAt?: Date;
}

export function useAgendamentos(filtroUserId?: string, filtroBarberId?: string, filtroData?: string) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAgendamentos([]);
      return;
    }

    try {
      // Montamos a consulta base
      let baseQuery = collection(db, 'agendamentos');
      let constraints = [];

      // Adicionamos filtros conforme os parâmetros
      if (filtroUserId) {
        constraints.push(where('uid', '==', filtroUserId));
      }
      
      if (filtroBarberId) {
        constraints.push(where('barberId', '==', filtroBarberId));
      }

      if (filtroData) {
        constraints.push(where('dateStr', '==', filtroData));
      }

      // Se o usuário for cliente e não for fornecido um filtro específico de usuário,
      // filtramos pelos próprios agendamentos
      if (user.role === 'user' && !filtroUserId) {
        constraints.push(where('uid', '==', user.uid));
      }

      // Se o usuário for barbeiro e não for fornecido um filtro específico de barbeiro,
      // filtramos pelos agendamentos dele
      if (user.role === 'barber' && !filtroBarberId && !filtroUserId) {
        constraints.push(where('barberId', '==', user.uid));
      }

      // Ordenamos por data e depois por horário
      constraints.push(orderBy('dateStr', 'asc'));
      
      // Aplicamos todos os filtros
      const q = query(baseQuery, ...constraints);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const dados: Agendamento[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          
          // Normalizamos os dados para garantir consistência
          const timeSlot = data.timeSlot || (data.timeSlots ? data.timeSlots.join(' - ') : '');
          
          return {
            id: doc.id,
            dateStr: data.dateStr,
            timeSlot: timeSlot,
            timeSlots: data.timeSlots || (data.timeSlot ? [data.timeSlot] : []),
            duration: data.duration || 30,
            service: data.service,
            barber: data.barber,
            barberId: data.barberId || '',
            name: data.name,
            status: data.status || 'confirmado',
            uid: data.uid,
            email: data.email,
            createdAt: data.createdAt ? new Date(data.createdAt.toDate()) : undefined
          };
        });
        
        setAgendamentos(dados);
        setLoading(false);
      }, (err) => {
        console.error('Erro ao carregar agendamentos:', err);
        setError('Não foi possível carregar os agendamentos.');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Erro ao configurar listener de agendamentos:', err);
      setError('Erro ao configurar busca de agendamentos.');
      setLoading(false);
    }
  }, [user, filtroUserId, filtroBarberId, filtroData]);

  return { agendamentos, loading, error };
}