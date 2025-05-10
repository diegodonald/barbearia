'use client';

import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ExtendedUser } from '@/types/ExtendedUser';
import { useOperatingHours } from '@/hooks/useOperatingHours';
import { useAgendamentos } from '@/hooks/useAgendamentos';
import { useServicos } from '@/hooks/useServicos';
import { useAgendamentosOperations } from '@/hooks/useAgendamentosOperations';
import { DayConfig, OperatingHours, Exception } from '@/types/common';
import {
  generateSlots,
  groupSlots,
  getEffectiveDayConfig,
  formatDate,
  getLocalDateString,
  getDayName,
} from '@/utils/slotUtils';
import errorMessages from '@/utils/errorMessages';

// Definição do defaultOperatingHours para casos onde não há configuração
const defaultOperatingHours: OperatingHours = {
  domingo: { active: false },
  segunda: { active: true, open: '08:00', close: '18:00' },
  terça: { active: true, open: '08:00', close: '18:00' },
  quarta: { active: true, open: '08:00', close: '18:00' },
  quinta: { active: true, open: '08:00', close: '18:00' },
  sexta: { active: true, open: '08:00', close: '18:00' },
  sábado: { active: true, open: '08:00', close: '13:00' },
};

// Interface para agendamento
interface Appointment {
  id: string;
  dateStr: string;
  timeSlot?: string;
  timeSlots?: string[];
  service: string;
  duration?: number;
  barber: string;
  barberId: string;
  name: string; // Nome do cliente
  status: string;
}

// Interface para opções de serviços
interface ServiceOption {
  name: string;
  duration: number;
  value: number;
}

// Interface para informações do barbeiro
interface BarberInfo {
  id: string;
  name: string;
}

const BarberDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { operatingHours, exceptions } = useOperatingHours(user?.uid);

  // Estados para listagem e edição de agendamentos existentes
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [filterDate, setFilterDate] = useState<string>('');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingTimeSlot, setEditingTimeSlot] = useState<string>('');
  const [editingService, setEditingService] = useState<string>('');
  const [editFeedback, setEditFeedback] = useState<string>('');

  // Estados para novos agendamentos para clientes
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newService, setNewService] = useState<string>('');
  const [newClientName, setNewClientName] = useState<string>('');
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTimeSlot, setNewTimeSlot] = useState<string>('');
  const [newFeedback, setNewFeedback] = useState<string>('');

  // Disponibilidade de horários (para edição e criação)
  const [availableSlots, setAvailableSlots] = useState<{
    manha: string[];
    tarde: string[];
    noite: string[];
  }>({ manha: [], tarde: [], noite: [] });

  const [newAvailableSlots, setNewAvailableSlots] = useState<{
    manha: string[];
    tarde: string[];
    noite: string[];
  }>({ manha: [], tarde: [], noite: [] });

  // Mapeia os slots já reservados
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Dados do barbeiro logado
  const [barberInfo, setBarberInfo] = useState<BarberInfo | null>(null);

  // Verificação de autenticação e role
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user) {
      if ((user as ExtendedUser).role !== 'barber') {
        router.push('/');
      } else {
        setBarberInfo({
          id: user.uid,
          name: (user as ExtendedUser).name || 'Barbeiro',
        });
      }
    }
  }, [user, loading, router]);

  // Buscar agendamentos do barbeiro
  const { agendamentos, loading: loadingAgendamentos } = useAgendamentos(undefined, user?.uid);

  useEffect(() => {
    if (!loadingAgendamentos) {
      setAppointments(agendamentos);
      setLoadingAppointments(false);
    }
  }, [agendamentos, loadingAgendamentos]);

  // Buscar serviços disponíveis
  const { servicos, loading: servicosLoading } = useServicos();

  // Operações de agendamentos
  const { createAgendamento, updateAgendamento, deleteAgendamento } = useAgendamentosOperations();

  // Atualiza os horários ocupados para o novo agendamento
  useEffect(() => {
    if (!newDate || !barberInfo || !user) return;

    const normalizedDateStr = getLocalDateString(newDate);

    // Obtém a configuração do dia
    const dayConfig = getEffectiveDayConfig(
      newDate,
      operatingHours || defaultOperatingHours,
      exceptions || []
    );

    if (!dayConfig || !dayConfig.active || !dayConfig.open || !dayConfig.close) {
      setNewFeedback('Este dia não está disponível para agendamentos.');
      setNewAvailableSlots({ manha: [], tarde: [], noite: [] });
      return;
    }

    // Gera todos os slots possíveis para o dia
    const allPossibleSlots = generateSlots(
      dayConfig.open,
      dayConfig.breakStart,
      dayConfig.breakEnd,
      dayConfig.close,
      30
    );

    // Busca os agendamentos existentes para esta data
    const q = query(
      collection(db, 'agendamentos'),
      where('dateStr', '==', normalizedDateStr),
      where('barberId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      // Reúne todos os slots ocupados
      let occupied: string[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.timeSlots && Array.isArray(data.timeSlots)) {
          occupied = [...occupied, ...data.timeSlots];
        } else if (data.timeSlot) {
          occupied.push(data.timeSlot);
        }
      });

      setBookedSlots(occupied);

      // Filtra para obter apenas os slots disponíveis
      const availableTimeSlots = allPossibleSlots.filter(slot => !occupied.includes(slot));

      if (availableTimeSlots.length === 0) {
        setNewFeedback('Não há horários disponíveis para esta data.');
        setNewAvailableSlots({ manha: [], tarde: [], noite: [] });
        return;
      }

      setNewAvailableSlots(groupSlots(availableTimeSlots));
      setNewFeedback('');
    });

    return () => unsubscribe();
  }, [newDate, barberInfo, operatingHours, exceptions, user]);

  // Atualiza os slots disponíveis para edição
  useEffect(() => {
    if (!editingDate || !barberInfo || !editingAppointment || !user) return;

    const normalizedDateStr = getLocalDateString(editingDate);
    const currentAppointmentId = editingAppointment.id;

    // Obtém a configuração do dia
    const dayConfig = getEffectiveDayConfig(
      editingDate,
      operatingHours || defaultOperatingHours,
      exceptions || []
    );

    if (!dayConfig || !dayConfig.active || !dayConfig.open || !dayConfig.close) {
      setEditFeedback('Este dia não está disponível para agendamentos.');
      setAvailableSlots({ manha: [], tarde: [], noite: [] });
      return;
    }

    // Gera todos os slots possíveis para o dia
    const allPossibleSlots = generateSlots(
      dayConfig.open,
      dayConfig.breakStart,
      dayConfig.breakEnd,
      dayConfig.close,
      30
    );

    // Busca os agendamentos existentes para esta data (excluindo o atual)
    const q = query(
      collection(db, 'agendamentos'),
      where('dateStr', '==', normalizedDateStr),
      where('barberId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      // Reúne todos os slots ocupados, excluindo o agendamento atual
      let occupied: string[] = [];
      snapshot.docs.forEach(docSnap => {
        if (docSnap.id !== currentAppointmentId) {
          const data = docSnap.data();
          if (data.timeSlots && Array.isArray(data.timeSlots)) {
            occupied = [...occupied, ...data.timeSlots];
          } else if (data.timeSlot) {
            occupied.push(data.timeSlot);
          }
        }
      });

      // Filtra para obter apenas os slots disponíveis
      const availableTimeSlots = allPossibleSlots.filter(slot => !occupied.includes(slot));

      if (availableTimeSlots.length === 0) {
        setEditFeedback('Não há horários disponíveis para esta data.');
        setAvailableSlots({ manha: [], tarde: [], noite: [] });
        return;
      }

      setAvailableSlots(groupSlots(availableTimeSlots));
      setEditFeedback('');
    });

    return () => unsubscribe();
  }, [editingDate, barberInfo, editingAppointment, operatingHours, exceptions, user]);

  // Filtro dos agendamentos existentes por data
  const filteredAppointments = appointments.filter(appt =>
    filterDate ? appt.dateStr === filterDate : true
  );

  // Ordena os agendamentos por data e horário antes de renderizar
  const sortedAppointments = filteredAppointments.sort((a, b) => {
    const dateComparison = a.dateStr.localeCompare(b.dateStr);
    if (dateComparison !== 0) return dateComparison;

    const timeA = a.timeSlot?.split(' - ')[0] || a.timeSlots?.[0] || '';
    const timeB = b.timeSlot?.split(' - ')[0] || b.timeSlots?.[0] || '';
    return timeA.localeCompare(timeB);
  });

  const setTodayFilter = () => {
    const today = new Date();
    setFilterDate(getLocalDateString(today));
  };

  const setTomorrowFilter = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFilterDate(getLocalDateString(tomorrow));
  };

  const clearFilters = () => {
    setFilterDate('');
  };

  // Edição dos agendamentos existentes
  const handleStartEditing = (appt: Appointment) => {
    setEditingAppointment({ ...appt });

    // Inicializa os estados de edição
    const [year, month, day] = appt.dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    setEditingDate(date);

    setEditingTimeSlot(appt.timeSlots?.[0] || appt.timeSlot || '');
    setEditingService(appt.service);
    setEditFeedback('');
  };

  const handleCancelEdit = () => {
    setEditingAppointment(null);
    setEditingDate(null);
    setEditingTimeSlot('');
    setEditingService('');
    setEditFeedback('');
  };

  const handleSaveEdit = async () => {
    if (!editingAppointment || !editingDate || !editingTimeSlot || !editingService || !barberInfo) {
      setEditFeedback('Preencha todos os campos');
      return;
    }

    try {
      // Encontrar o serviço selecionado para obter a duração
      const service = servicos.find(s => s.name === editingService);
      if (!service) {
        setEditFeedback('Serviço não encontrado');
        return;
      }

      // Calcular os slots necessários baseados na duração
      const slotsNeeded = Math.ceil(service.duration / 30);

      // Verificar se há slots suficientes disponíveis após o horário inicial
      const allSlots = [
        ...availableSlots.manha,
        ...availableSlots.tarde,
        ...availableSlots.noite,
      ].sort();

      const startIndex = allSlots.indexOf(editingTimeSlot);
      if (startIndex === -1) {
        setEditFeedback(errorMessages.slotNotAvailable);
        return;
      }

      if (startIndex + slotsNeeded > allSlots.length) {
        setEditFeedback(errorMessages.serviceExceedsClosing);
        return;
      }

      // Verificar se os slots são consecutivos
      const requiredSlots = allSlots.slice(startIndex, startIndex + slotsNeeded);

      // Verificar se os slots cruzam intervalo
      for (let i = 1; i < requiredSlots.length; i++) {
        const prevSlot = requiredSlots[i - 1];
        const currSlot = requiredSlots[i];

        const [prevHour, prevMin] = prevSlot.split(':').map(Number);
        const [currHour, currMin] = currSlot.split(':').map(Number);

        const prevTotalMins = prevHour * 60 + prevMin;
        const currTotalMins = currHour * 60 + currMin;

        if (currTotalMins - prevTotalMins !== 30) {
          setEditFeedback(errorMessages.serviceCrossesBreak);
          return;
        }
      }

      const dateStr = getLocalDateString(editingDate);

      const result = await updateAgendamento(editingAppointment.id, {
        dateStr: dateStr,
        timeSlots: requiredSlots,
        timeSlot: requiredSlots[0],
        service: editingService,
        duration: service.duration,
        barber: barberInfo.name,
        barberId: barberInfo.id,
        status: editingAppointment.status,
      });

      if (result.success) {
        handleCancelEdit();
        setNewFeedback('Agendamento atualizado com sucesso!');
        setTimeout(() => setNewFeedback(''), 3000);
      } else {
        setEditFeedback(result.error || 'Erro ao atualizar agendamento');
      }
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      setEditFeedback('Erro ao salvar. Tente novamente.');
    }
  };

  const handleCancelAppointment = async (appt: Appointment) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
      const result = await deleteAgendamento(appt.id);
      if (result.success) {
        setNewFeedback('Agendamento cancelado com sucesso!');
        setTimeout(() => setNewFeedback(''), 3000);
      } else {
        setNewFeedback('Erro ao cancelar agendamento: ' + (result.error || ''));
      }
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      setNewFeedback('Erro ao cancelar agendamento. Tente novamente.');
    }
  };

  const handleConfirmNewAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setNewFeedback('Por favor, selecione uma data.');
      return;
    }
    if (!newTimeSlot) {
      setNewFeedback('Por favor, selecione um horário.');
      return;
    }
    if (!newService) {
      setNewFeedback('Por favor, selecione um serviço.');
      return;
    }
    if (!newClientName) {
      setNewFeedback('Por favor, informe o nome do cliente.');
      return;
    }
    if (bookedSlots.includes(newTimeSlot)) {
      setNewFeedback('Esse horário não está disponível. Por favor, escolha outro.');
      return;
    }

    try {
      // Encontrar o serviço selecionado para obter a duração
      const service = servicos.find(s => s.name === newService);
      if (!service) {
        setNewFeedback('Serviço não encontrado');
        return;
      }

      // Calcular os slots necessários baseados na duração
      const slotsNeeded = Math.ceil(service.duration / 30);

      // Verificar se há slots suficientes disponíveis após o horário inicial
      const allSlots = [
        ...newAvailableSlots.manha,
        ...newAvailableSlots.tarde,
        ...newAvailableSlots.noite,
      ].sort();

      const startIndex = allSlots.indexOf(newTimeSlot);
      if (startIndex === -1) {
        setNewFeedback(errorMessages.slotNotAvailable);
        return;
      }

      if (startIndex + slotsNeeded > allSlots.length) {
        setNewFeedback(errorMessages.insufficientSlots);
        return;
      }

      // Verificar se os slots são consecutivos
      const requiredSlots = allSlots.slice(startIndex, startIndex + slotsNeeded);

      // Verificar se algum slot está ocupado
      if (requiredSlots.some(slot => bookedSlots.includes(slot))) {
        setNewFeedback(errorMessages.slotAlreadyBooked);
        return;
      }

      // Verificar se os slots cruzam intervalo
      for (let i = 1; i < requiredSlots.length; i++) {
        const prevSlot = requiredSlots[i - 1];
        const currSlot = requiredSlots[i];

        const [prevHour, prevMin] = prevSlot.split(':').map(Number);
        const [currHour, currMin] = currSlot.split(':').map(Number);

        const prevTotalMins = prevHour * 60 + prevMin;
        const currTotalMins = currHour * 60 + currMin;

        if (currTotalMins - prevTotalMins !== 30) {
          setNewFeedback(errorMessages.serviceCrossesBreak);
          return;
        }
      }

      const normalizedDateStr = getLocalDateString(newDate);

      // Verificar se barberInfo existe antes de prosseguir
      if (!barberInfo || !barberInfo.id) {
        setNewFeedback('Informações do barbeiro não disponíveis. Tente novamente.');
        return;
      }

      const result = await createAgendamento({
        uid: user!.uid, // O barbeiro é quem cria o agendamento
        email: user?.email ?? undefined,
        name: newClientName,
        service: newService,
        duration: service.duration,
        barber: barberInfo.name || 'Barbeiro',
        barberId: barberInfo.id,
        dateStr: normalizedDateStr,
        timeSlots: requiredSlots,
        timeSlot: requiredSlots[0], // Para compatibilidade
        createdAt: new Date(),
        status: 'confirmado',
      });

      if (result.success) {
        setNewFeedback('Agendamento salvo com sucesso!');
        setNewService('');
        setNewClientName('');
        setNewDate(null);
        setNewTimeSlot('');

        setTimeout(() => {
          setIsCreating(false);
          setNewFeedback('');
        }, 2000);
      } else {
        setNewFeedback('Erro ao salvar agendamento: ' + (result.error || ''));
      }
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      setNewFeedback('Erro ao salvar agendamento. Tente novamente.');
    }
  };

  if (loading || !user || loadingAppointments) {
    return <p>Carregando dados...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Painel do Barbeiro</h1>

      {/* Mensagem de feedback */}
      {newFeedback && (
        <div className="mb-4 p-2 bg-green-100 text-green-800 rounded text-center">
          {newFeedback}
        </div>
      )}

      {/* Seção de Filtros para agendamentos existentes */}
      <div className="mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block mb-1">Filtrar por Data:</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 bg-gray-200 text-black rounded"
          />
        </div>
        <button
          onClick={setTodayFilter}
          className="bg-blue-500 px-3 py-2 rounded hover:bg-blue-600 transition"
        >
          Hoje
        </button>
        <button
          onClick={setTomorrowFilter}
          className="bg-blue-500 px-3 py-2 rounded hover:bg-blue-600 transition"
        >
          Amanhã
        </button>
        <button
          onClick={clearFilters}
          className="bg-gray-500 px-3 py-2 rounded hover:bg-gray-600 transition"
        >
          Limpar Filtro
        </button>
      </div>

      {/* Seção de Novo Agendamento para Cliente */}
      <div className="mb-8">
        {isCreating ? (
          <div className="bg-gray-900 p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4">Novo Agendamento para Cliente</h2>
            <form onSubmit={handleConfirmNewAppointment} className="space-y-4">
              <div>
                <label className="block mb-1">Serviço:</label>
                <select
                  value={newService}
                  onChange={e => setNewService(e.target.value)}
                  className="w-full px-3 py-2 border rounded bg-white text-black"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.duration} min)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1">Nome do Cliente:</label>
                <input
                  type="text"
                  placeholder="Digite o nome do cliente"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 border rounded bg-white text-black"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Selecione a Data:</label>
                <DatePicker
                  selected={newDate}
                  onChange={(date: Date | null) => {
                    setNewDate(date);
                    setNewTimeSlot('');
                  }}
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  className="w-full px-3 py-2 border rounded text-black"
                  placeholderText="Selecione uma data"
                  required
                />
              </div>
              {newDate && (
                <>
                  <h3 className="text-lg mt-4">Horários Disponíveis</h3>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {Object.entries(newAvailableSlots).map(([period, slots]) => {
                      if (slots.length === 0) return null;

                      return (
                        <div key={period}>
                          <h4 className="font-bold capitalize">
                            {period === 'manha' ? 'manhã' : period === 'tarde' ? 'tarde' : 'noite'}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slots.map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setNewTimeSlot(slot)}
                                className={`px-3 py-1 border rounded ${
                                  newTimeSlot === slot
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-black'
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {newAvailableSlots.manha.length === 0 &&
                    newAvailableSlots.tarde.length === 0 &&
                    newAvailableSlots.noite.length === 0 && (
                      <p className="text-red-500 mt-2">
                        Não há horários disponíveis para esta data
                      </p>
                    )}
                </>
              )}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  disabled={!newDate || !newTimeSlot || !newService || !newClientName}
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-green-500 text-white px-4 py-2 rounded mb-8"
          >
            Novo Agendamento para Cliente
          </button>
        )}
      </div>

      {/* Modal de Edição */}
      {editingAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-90vh overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Editar Agendamento</h2>

            <div className="space-y-4">
              <div>
                <label className="block mb-1">Cliente</label>
                <input
                  type="text"
                  value={editingAppointment.name}
                  className="px-3 py-2 bg-gray-200 w-full rounded"
                  readOnly
                />
              </div>

              <div>
                <label className="block mb-1">Data</label>
                <DatePicker
                  selected={editingDate}
                  onChange={(date: Date | null) => {
                    setEditingDate(date);
                    setEditingTimeSlot('');
                  }}
                  dateFormat="dd/MM/yyyy"
                  className="px-3 py-2 border w-full rounded"
                />
              </div>

              <div>
                <label className="block mb-1">Serviço</label>
                <select
                  value={editingService}
                  onChange={e => setEditingService(e.target.value)}
                  className="px-3 py-2 bg-white border w-full rounded"
                >
                  {servicos.map(service => (
                    <option key={service.name} value={service.name}>
                      {service.name} ({service.duration} min)
                    </option>
                  ))}
                </select>
              </div>

              {editingDate && (
                <div>
                  <label className="block mb-1">Horário</label>
                  <div className="space-y-2">
                    {Object.entries(availableSlots).map(([period, slots]) => {
                      if (slots.length === 0) return null;

                      return (
                        <div key={period}>
                          <h4 className="font-medium capitalize">
                            {period === 'manha' ? 'manhã' : period === 'tarde' ? 'tarde' : 'noite'}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slots.map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setEditingTimeSlot(slot)}
                                className={`px-3 py-1 border rounded ${
                                  editingTimeSlot === slot
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-black'
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {availableSlots.manha.length === 0 &&
                    availableSlots.tarde.length === 0 &&
                    availableSlots.noite.length === 0 && (
                      <p className="text-red-500 mt-2">
                        Não há horários disponíveis para esta data
                      </p>
                    )}
                </div>
              )}

              <div>
                <label className="block mb-1">Status</label>
                <select
                  value={editingAppointment.status}
                  onChange={e =>
                    setEditingAppointment({
                      ...editingAppointment,
                      status: e.target.value,
                    })
                  }
                  className="px-3 py-2 bg-white border w-full rounded"
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>

              {editFeedback && (
                <div className="p-2 bg-red-100 text-red-700 rounded">{editFeedback}</div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  disabled={!editingDate || !editingTimeSlot || !editingService}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listagem e Edição dos Agendamentos Existentes */}
      {filteredAppointments.length === 0 ? (
        <p>Nenhum agendamento encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border">Data</th>
                <th className="px-4 py-2 border">Horário</th>
                <th className="px-4 py-2 border">Serviço</th>
                <th className="px-4 py-2 border">Barbeiro</th>
                <th className="px-4 py-2 border">Cliente</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedAppointments.map(app => (
                <tr key={app.id}>
                  <td className="px-4 py-2 border">{formatDate(app.dateStr)}</td>
                  <td className="px-4 py-2 border">{app.timeSlot || app.timeSlots?.[0] || ''}</td>
                  <td className="px-4 py-2 border">{app.service}</td>
                  <td className="px-4 py-2 border">{app.barber}</td>
                  <td className="px-4 py-2 border">{app.name}</td>
                  <td className="px-4 py-2 border">{app.status}</td>
                  <td className="px-4 py-2 border">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleStartEditing(app)}
                        className="bg-yellow-500 px-3 py-1 rounded hover:bg-yellow-600 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleCancelAppointment(app)}
                        className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BarberDashboard;
