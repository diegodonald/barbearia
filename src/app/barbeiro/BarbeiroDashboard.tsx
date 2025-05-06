"use client";

import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { ExtendedUser } from "@/hooks/useAuth";

// Extend the ExtendedUser type to include the 'name' property
interface ExtendedUserWithName extends ExtendedUser {
  name?: string;
  horarios?: OperatingHours | null;
  exceptions?: any[];
}
import { useOperatingHours } from "@/hooks/useOperatingHours";
import errorMessages from "@/utils/errorMessages";
import { DayConfig, OperatingHours, Exception } from '@/types/common';

// Adicione esta constante no início do arquivo, após as importações:
const defaultOperatingHours: OperatingHours = {
  domingo: { active: false },
  segunda: { active: true, open: '08:00', close: '18:00' },
  terça: { active: true, open: '08:00', close: '18:00' },
  quarta: { active: true, open: '08:00', close: '18:00' },
  quinta: { active: true, open: '08:00', close: '18:00' },
  sexta: { active: true, open: '08:00', close: '18:00' },
  sábado: { active: true, open: '08:00', close: '13:00' }
};

// Função auxiliar para converter "YYYY-MM-DD" para "DD/MM/YYYY"
const formatDate = (dateStr: string): string => {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Função auxiliar que retorna a data no formato "YYYY-MM-DD" usando o horário local
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Função para obter o nome do dia da semana
function getDayName(date: Date): keyof OperatingHours {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return days[date.getDay()] as keyof OperatingHours;
}

// Gera os slots de horário entre um início e um fim com um intervalo (em minutos)
function generateSlots(
  open: string,
  breakStart: string | undefined,
  breakEnd: string | undefined,
  end: string,
  interval: number
): string[] {
  const [openHour, openMinute] = open.split(":").map(Number);
  const startTotal = openHour * 60 + openMinute;
  const [endHour, endMinute] = end.split(":").map(Number);
  const endTotal = endHour * 60 + endMinute;

  let breakStartTotal = -1, breakEndTotal = -1;
  if (breakStart && breakEnd) {
    const [bsHour, bsMinute] = breakStart.split(":").map(Number);
    breakStartTotal = bsHour * 60 + bsMinute;
    const [beHour, beMinute] = breakEnd.split(":").map(Number);
    breakEndTotal = beHour * 60 + beMinute;
  }
  
  const slots: string[] = [];
  for (let time = startTotal; time < endTotal - interval + 1; time += interval) {
    if (breakStartTotal >= 0 && breakEndTotal > 0) {
      const slotEnd = time + interval;
      if (
        (time >= breakStartTotal && time < breakEndTotal) ||
        (slotEnd > breakStartTotal && slotEnd <= breakEndTotal) ||
        (time < breakStartTotal && slotEnd > breakEndTotal)
      ) {
        continue;
      }
    }
    
    const hour = Math.floor(time / 60);
    const minute = time % 60;
    slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
  }
  
  return slots;
}

// Agrupa os slots em períodos para exibição (manhã, tarde e noite)
function groupSlots(slots: string[]): { manha: string[]; tarde: string[]; noite: string[] } {
  const manha = slots.filter((slot) => slot < "12:00");
  const tarde = slots.filter((slot) => slot >= "12:00" && slot < "17:00");
  const noite = slots.filter((slot) => slot >= "17:00");
  return { manha, tarde, noite };
}

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

// Interface para representar barbeiros (para dropdown de referência, se necessário)
interface BarberOption {
  id: string;
  name: string;
  horarios?: OperatingHours | null;
  exceptions?: any[];
}

// Interface para serviços
interface ServiceOption {
  name: string;
  duration: number;
  value: number;
}

// Função para obter configuração efetiva do dia
function getEffectiveDayConfig(
  barber: BarberOption,
  date: Date,
  globalOperatingHours: OperatingHours,
  globalExceptions: any[]
): DayConfig | null {
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);

  // Verifica configuração individual do barbeiro
  let individualConfig: DayConfig | null = null;
  if (barber.horarios && barber.horarios[dayName] !== undefined) {
    individualConfig = barber.horarios[dayName];
  }

  // Verifica exceções (individuais ou globais)
  const effectiveExceptions = barber.exceptions && barber.exceptions.length > 0 ? barber.exceptions : globalExceptions;
  if (effectiveExceptions) {
    const exception = effectiveExceptions.find((ex: any) => ex.date === normalizedDate);
    if (exception) {
      if (exception.status === "blocked") {
        return null;
      }
      if (exception.status === "available" && exception.open && exception.close) {
        return { open: exception.open, close: exception.close, active: true };
      }
    }
  }

  // Usa configuração individual, se disponível
  if (individualConfig) {
    return individualConfig && individualConfig.active && individualConfig.open && individualConfig.close
      ? individualConfig
      : null;
  }

  // Caso contrário, usa a configuração global
  const globalConfig = globalOperatingHours[dayName];
  return globalConfig && globalConfig.active && globalConfig.open && globalConfig.close ? globalConfig : null;
}

const BarberDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { operatingHours, exceptions } = useOperatingHours();

  // Estados para listagem e edição de agendamentos existentes
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [filterDate, setFilterDate] = useState<string>("");
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingTimeSlot, setEditingTimeSlot] = useState<string>("");
  const [editingService, setEditingService] = useState<string>("");
  const [editFeedback, setEditFeedback] = useState<string>("");

  // Estados para novos agendamentos para clientes
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newService, setNewService] = useState<string>("");
  const [newClientName, setNewClientName] = useState<string>("");
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTimeSlot, setNewTimeSlot] = useState<string>("");
  const [newFeedback, setNewFeedback] = useState<string>("");

  // Estados para opções dinâmicas
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);

  // Dados do barbeiro logado
  const [barberInfo, setBarberInfo] = useState<BarberOption | null>(null);

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

  // Verificação de autenticação e role
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      if (user) {
        const userData = user as ExtendedUserWithName;
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user) {
      const userData = user as ExtendedUserWithName;
      setBarberInfo({ 
        id: user.uid, 
        name: userData.name || "", 
        horarios: userData.horarios || null,
        exceptions: userData.exceptions || []
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && user) {
      if ((user as ExtendedUser).role !== "barber") {
        router.push("/");
      }
    }
  }, [user, loading, router]);

  // Busca dos agendamentos do barbeiro (filtrados pelo barberId)
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "agendamentos"),
        where("barberId", "==", user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const appsData: Appointment[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const timeSlotValue = data.timeSlot || (data.timeSlots ? data.timeSlots.join(" - ") : "");
          return {
            id: docSnap.id,
            dateStr: data.dateStr,
            timeSlot: timeSlotValue,
            timeSlots: data.timeSlots || (data.timeSlot ? [data.timeSlot] : []),
            service: data.service,
            duration: data.duration || 30,
            barber: data.barber,
            barberId: data.barberId,
            name: data.name,
            status: data.status ? data.status : "confirmado",
          };
        });
        setAppointments(appsData);
        setLoadingAppointments(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Busca das opções de serviços a partir da coleção "servicos"
  useEffect(() => {
    async function fetchServiceOptions() {
      try {
        const q = query(collection(db, "servicos"));
        const snapshot = await getDocs(q);
        const services = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            name: data.name,
            duration: Number(data.duration),
            value: Number(data.value),
          };
        });
        setServiceOptions(services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
      }
    }
    fetchServiceOptions();
  }, []);

  // Atualiza os horários ocupados para o novo agendamento
  useEffect(() => {
    if (!newDate || !barberInfo) return;
    
    const normalizedDateStr = getLocalDateString(newDate);
    
    // Obtém a configuração do dia
    const dayConfig = getEffectiveDayConfig(
      barberInfo,
      newDate,
      operatingHours || defaultOperatingHours,
      exceptions || []
    );
    
    if (!dayConfig || !dayConfig.active || !dayConfig.open || !dayConfig.close) {
      setNewFeedback("Este dia não está disponível para agendamentos.");
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
      collection(db, "agendamentos"),
      where("dateStr", "==", normalizedDateStr),
      where("barberId", "==", barberInfo.id)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Reúne todos os slots ocupados
      let occupied: string[] = [];
      snapshot.docs.forEach((docSnap) => {
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
        setNewFeedback("Não há horários disponíveis para esta data.");
        setNewAvailableSlots({ manha: [], tarde: [], noite: [] });
        return;
      }
      
      setNewAvailableSlots(groupSlots(availableTimeSlots));
      setNewFeedback("");
    });
    
    return () => unsubscribe();
  }, [newDate, barberInfo, operatingHours, exceptions]);

  // Atualiza os slots disponíveis para edição
  useEffect(() => {
    if (!editingDate || !barberInfo || !editingAppointment) return;
    
    const normalizedDateStr = getLocalDateString(editingDate);
    const currentAppointmentId = editingAppointment.id;
    
    // Obtém a configuração do dia
    const dayConfig = getEffectiveDayConfig(
      barberInfo,
      editingDate,
      operatingHours || defaultOperatingHours,
      exceptions || []
    );
    
    if (!dayConfig || !dayConfig.active || !dayConfig.open || !dayConfig.close) {
      setEditFeedback("Este dia não está disponível para agendamentos.");
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
      collection(db, "agendamentos"),
      where("dateStr", "==", normalizedDateStr),
      where("barberId", "==", barberInfo.id)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Reúne todos os slots ocupados, excluindo o agendamento atual
      let occupied: string[] = [];
      snapshot.docs.forEach((docSnap) => {
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
        setEditFeedback("Não há horários disponíveis para esta data.");
        setAvailableSlots({ manha: [], tarde: [], noite: [] });
        return;
      }
      
      setAvailableSlots(groupSlots(availableTimeSlots));
      setEditFeedback("");
    });
    
    return () => unsubscribe();
  }, [editingDate, barberInfo, editingAppointment, operatingHours, exceptions]);

  // Filtro dos agendamentos existentes por data
  const filteredAppointments = appointments.filter((appt) =>
    filterDate ? appt.dateStr === filterDate : true
  );

  // Ordena os agendamentos por data e horário antes de renderizar
  const sortedAppointments = filteredAppointments.sort((a, b) => {
    const dateComparison = a.dateStr.localeCompare(b.dateStr);
    if (dateComparison !== 0) return dateComparison;
  
    const timeA = a.timeSlot?.split(" - ")[0] || "";
    const timeB = b.timeSlot?.split(" - ")[0] || "";
    return timeA.localeCompare(timeB);
  });

  const setTodayFilter = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setFilterDate(`${yyyy}-${mm}-${dd}`);
  };

  const setTomorrowFilter = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setFilterDate(`${yyyy}-${mm}-${dd}`);
  };

  const clearFilters = () => {
    setFilterDate("");
  };

  // Edição dos agendamentos existentes
  const handleStartEditing = (appt: Appointment) => {
    setEditingAppointment({ ...appt });
    
    // Inicializa os estados de edição
    const [year, month, day] = appt.dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    setEditingDate(date);
    
    setEditingTimeSlot(appt.timeSlots?.[0] || appt.timeSlot || "");
    setEditingService(appt.service);
    setEditFeedback("");
  };

  const handleCancelEdit = () => {
    setEditingAppointment(null);
    setEditingDate(null);
    setEditingTimeSlot("");
    setEditingService("");
    setEditFeedback("");
  };

  const handleSaveEdit = async () => {
    if (!editingAppointment || !editingDate || !editingTimeSlot || !editingService || !barberInfo) {
      setEditFeedback("Preencha todos os campos");
      return;
    }

    try {
      // Encontrar o serviço selecionado para obter a duração
      const service = serviceOptions.find(s => s.name === editingService);
      if (!service) {
        setEditFeedback("Serviço não encontrado");
        return;
      }

      // Calcular os slots necessários baseados na duração
      const slotsNeeded = Math.ceil(service.duration / 30);
      
      // Verificar se há slots suficientes disponíveis após o horário inicial
      const allSlots = [
        ...availableSlots.manha,
        ...availableSlots.tarde,
        ...availableSlots.noite
      ].sort();
      
      const startIndex = allSlots.indexOf(editingTimeSlot);
      if (startIndex === -1) {
        setEditFeedback(errorMessages.slotNotAvailable); // Atualizado
        return;
      }
      
      if (startIndex + slotsNeeded > allSlots.length) {
        setEditFeedback(errorMessages.serviceExceedsClosing);
        return;
      }
      
      // Verificar se os slots são consecutivos
      const requiredSlots = allSlots.slice(startIndex, startIndex + slotsNeeded);
      
      // Verificar se algum slot está ocupado
      const barberBooked = bookedSlots || [];
      if (requiredSlots.some(slot => barberBooked.includes(slot))) {
        setEditFeedback(errorMessages.slotAlreadyBooked);
        return;
      }
      
      // Verificar se os slots cruzam intervalo
      for (let i = 1; i < requiredSlots.length; i++) {
        const prevSlot = requiredSlots[i-1];
        const currSlot = requiredSlots[i];
        
        const [prevHour, prevMin] = prevSlot.split(":").map(Number);
        const [currHour, currMin] = currSlot.split(":").map(Number);
        
        const prevTotalMins = prevHour * 60 + prevMin;
        const currTotalMins = currHour * 60 + currMin;
        
        if (currTotalMins - prevTotalMins !== 30) {
          setEditFeedback(errorMessages.serviceCrossesBreak);
          return;
        }
      }
      
      const dateStr = getLocalDateString(editingDate);
      
      await updateDoc(doc(db, "agendamentos", editingAppointment.id), {
        dateStr: dateStr,
        timeSlots: requiredSlots,
        timeSlot: null,  // Limpa o campo antigo
        service: editingService,
        duration: service.duration,
        barber: barberInfo.name,
        barberId: barberInfo.id,
        status: editingAppointment.status,
      });
      
      handleCancelEdit();
      setNewFeedback("Agendamento atualizado com sucesso!");
      setTimeout(() => setNewFeedback(""), 3000);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      setEditFeedback("Erro ao salvar. Tente novamente.");
    }
  };

  const handleCancelAppointment = async (appt: Appointment) => {
    if (!confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      await deleteDoc(doc(db, "agendamentos", appt.id));
      setNewFeedback("Agendamento cancelado com sucesso!");
      setTimeout(() => setNewFeedback(""), 3000);
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      setNewFeedback("Erro ao cancelar agendamento. Tente novamente.");
    }
  };

  const handleConfirmNewAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) {
      setNewFeedback("Por favor, selecione uma data.");
      return;
    }
    if (!newTimeSlot) {
      setNewFeedback("Por favor, selecione um horário.");
      return;
    }
    if (!newService) {
      setNewFeedback("Por favor, selecione um serviço.");
      return;
    }
    if (!newClientName) {
      setNewFeedback("Por favor, informe o nome do cliente.");
      return;
    }
    if (bookedSlots.includes(newTimeSlot)) {
      setNewFeedback("Esse horário não está disponível. Por favor, escolha outro.");
      return;
    }
    
    try {
      // Encontrar o serviço selecionado para obter a duração
      const service = serviceOptions.find(s => s.name === newService);
      if (!service) {
        setNewFeedback("Serviço não encontrado");
        return;
      }

      // Calcular os slots necessários baseados na duração
      const slotsNeeded = Math.ceil(service.duration / 30);
      
      // Verificar se há slots suficientes disponíveis após o horário inicial
      const allSlots = [
        ...newAvailableSlots.manha,
        ...newAvailableSlots.tarde,
        ...newAvailableSlots.noite
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
        const prevSlot = requiredSlots[i-1];
        const currSlot = requiredSlots[i];
        
        const [prevHour, prevMin] = prevSlot.split(":").map(Number);
        const [currHour, currMin] = currSlot.split(":").map(Number);
        
        const prevTotalMins = prevHour * 60 + prevMin;
        const currTotalMins = currHour * 60 + currMin;
        
        if (currTotalMins - prevTotalMins !== 30) {
          setNewFeedback(errorMessages.serviceCrossesBreak);
          return;
        }
      }
      
      const normalizedDateStr = getLocalDateString(newDate);
      
      await addDoc(collection(db, "agendamentos"), {
        uid: barberInfo?.id, // Usando o ID do barbeiro como "proprietário" do agendamento
        email: user?.email,
        name: newClientName,
        service: newService,
        duration: service.duration,
        barber: barberInfo?.name,
        barberId: barberInfo?.id,
        dateStr: normalizedDateStr,
        timeSlots: requiredSlots,
        createdAt: new Date(),
        status: "confirmado",
      });
      
      setNewFeedback("Agendamento salvo com sucesso!");
      setNewService("");
      setNewClientName("");
      setNewDate(null);
      setNewTimeSlot("");
      
      setTimeout(() => {
        setIsCreating(false);
        setNewFeedback("");
      }, 2000);
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      setNewFeedback("Erro ao salvar agendamento. Tente novamente.");
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
            onChange={(e) => setFilterDate(e.target.value)}
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
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full px-3 py-2 border rounded bg-white text-black"
                  required
                >
                  <option value="">Selecione um serviço</option>
                  {serviceOptions.map((s) => (
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
                  onChange={(e) => setNewClientName(e.target.value)}
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
                    setNewTimeSlot("");
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
                            {period === "manha" ? "manhã" : period === "tarde" ? "tarde" : "noite"}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setNewTimeSlot(slot)}
                                className={`px-3 py-1 border rounded ${
                                  newTimeSlot === slot
                                    ? "bg-blue-500 text-white"
                                    : "bg-white text-black"
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
                  
                  {(newAvailableSlots.manha.length === 0 && 
                    newAvailableSlots.tarde.length === 0 && 
                    newAvailableSlots.noite.length === 0) && (
                    <p className="text-red-500 mt-2">Não há horários disponíveis para esta data</p>
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
                    setEditingTimeSlot("");
                  }}
                  dateFormat="dd/MM/yyyy"
                  className="px-3 py-2 border w-full rounded"
                />
              </div>
              
              <div>
                <label className="block mb-1">Serviço</label>
                <select
                  value={editingService}
                  onChange={(e) => setEditingService(e.target.value)}
                  className="px-3 py-2 bg-white border w-full rounded"
                >
                  {serviceOptions.map((service) => (
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
                            {period === "manha" ? "manhã" : period === "tarde" ? "tarde" : "noite"}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setEditingTimeSlot(slot)}
                                className={`px-3 py-1 border rounded ${
                                  editingTimeSlot === slot ? "bg-blue-500 text-white" : "bg-white text-black"
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
                  
                  {(availableSlots.manha.length === 0 && 
                    availableSlots.tarde.length === 0 && 
                    availableSlots.noite.length === 0) && (
                    <p className="text-red-500 mt-2">Não há horários disponíveis para esta data</p>
                  )}
                </div>
              )}
              
              <div>
                <label className="block mb-1">Status</label>
                <select
                  value={editingAppointment.status}
                  onChange={(e) =>
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
                <div className="p-2 bg-red-100 text-red-700 rounded">
                  {editFeedback}
                </div>
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
              {sortedAppointments.map((app) => (
                <tr key={app.id}>
                  <td className="px-4 py-2 border">{formatDate(app.dateStr)}</td>
                  <td className="px-4 py-2 border">{app.timeSlot}</td>
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