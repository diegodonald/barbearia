"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
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
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ExtendedUser } from "@/hooks/useAuth";
import { useOperatingHours } from "@/hooks/useOperatingHours";

// Função auxiliar para converter datas em "YYYY-MM-DD" usando o horário local
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Função auxiliar para formatar a data em "DD/MM/YYYY"
const formatDate = (dateStr: string): string => {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Obtém o nome do dia a partir da data
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

// Interface para configuração de um dia
interface DayConfig {
  open?: string;
  breakStart?: string;
  breakEnd?: string;
  close?: string;
  active: boolean;
}

// OperatingHours
export interface OperatingHours {
  domingo: DayConfig;
  segunda: DayConfig;
  terça: DayConfig;
  quarta: DayConfig;
  quinta: DayConfig;
  sexta: DayConfig;
  sábado: DayConfig;
}

// Interface do agendamento
interface Appointment {
  id: string;
  dateStr: string;
  timeSlot: string;
  timeSlots?: string[];
  service: string;
  duration?: number;
  barber: string;
  barberId: string;
  name: string; // Nome do cliente
  status: string;
}

// Interface para as opções de barbeiro (usada no dropdown na edição)
interface BarberOption {
  id: string;
  name: string;
  horarios?: OperatingHours | null;
  exceptions?: any[];
}

// Configuração global padrão (usada se necessário)
const defaultOperatingHours: OperatingHours = {
  segunda: { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "18:00", active: true },
  terça: { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "18:00", active: true },
  quarta: { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "18:00", active: true },
  quinta: { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "18:00", active: true },
  sexta: { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "18:00", active: true },
  sábado: { open: "09:00", breakStart: "12:00", breakEnd: "13:30", close: "14:00", active: true },
  domingo: { active: false },
};

function getEffectiveDayConfig(
  barber: BarberOption,
  date: Date,
  globalOperatingHours: OperatingHours,
  globalExceptions: any[]
): DayConfig | null {
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);

  // Se houver configuração individual definida (horarios) para o dia, use-a.
  let individualConfig: DayConfig | null = null;
  if (barber.horarios && barber.horarios[dayName] !== undefined) {
    individualConfig = barber.horarios[dayName];
  }

  // Verificar exceções
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

  // Se individualConfig foi encontrada, use-a.
  if (individualConfig) {
    return individualConfig && individualConfig.active && individualConfig.open && individualConfig.close
      ? individualConfig
      : null;
  }

  // Caso contrário, use a configuração global.
  const globalConfig = globalOperatingHours[dayName];
  return globalConfig && globalConfig.active && globalConfig.open && globalConfig.close ? globalConfig : null;
}

const ClientAppointments: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { operatingHours, exceptions } = useOperatingHours();

  // Estados básicos
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [filterDate, setFilterDate] = useState<string>("");

  // Estado para controle da edição inline de um agendamento
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingTimeSlot, setEditingTimeSlot] = useState<string>("");
  const [editingService, setEditingService] = useState<string>("");
  const [editingBarber, setEditingBarber] = useState<BarberOption | null>(null);

  // Estados para opções dinâmicas
  const [serviceOptions, setServiceOptions] = useState<{name: string; duration: number; value: number}[]>([]);
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);

  // Estado para feedback de operação (edição e cancelamento)
  const [feedback, setFeedback] = useState<string>("");
  const [editFeedback, setEditFeedback] = useState<string>("");

  // Disponibilidade de horários
  const [availableSlots, setAvailableSlots] = useState<{
    manha: string[];
    tarde: string[];
    noite: string[];
  }>({ manha: [], tarde: [], noite: [] });

  // Mapeia cada barberId para os slots já reservados
  const [bookedSlotsByBarber, setBookedSlotsByBarber] = useState<Record<string, string[]>>({});

  // Verifica autenticação; se não estiver logado, redireciona
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Busca os agendamentos do cliente (filtrando pelo campo "uid" do agendamento)
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "agendamentos"),
        where("uid", "==", user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const apps: Appointment[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const time = data.timeSlot || (data.timeSlots ? data.timeSlots.join(" - ") : "");
          return {
            id: docSnap.id,
            dateStr: data.dateStr,
            timeSlot: time,
            timeSlots: data.timeSlots || (data.timeSlot ? [data.timeSlot] : []),
            service: data.service,
            duration: data.duration || 30,
            barber: data.barber,
            barberId: data.barberId,
            name: data.name,
            status: data.status ? data.status : "confirmado",
          };
        });
        setAppointments(apps);
        setLoadingAppointments(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Busca as opções dinâmicas de serviços (da coleção "servicos")
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

  // Busca as opções dinâmicas de barbeiros (da coleção "usuarios", onde role === "barber")
  useEffect(() => {
    async function fetchBarberOptions() {
      try {
        const q = query(collection(db, "usuarios"), where("role", "==", "barber"));
        const snapshot = await getDocs(q);
        const barbers = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            horarios: data.horarios || null,
            exceptions: data.exceptions || []
          };
        });
        setBarberOptions(barbers);
      } catch (error) {
        console.error("Erro ao buscar barbeiros:", error);
      }
    }
    fetchBarberOptions();
  }, []);

  // Atualiza os agendamentos da data em edição
  useEffect(() => {
    if (!editingDate) return;
    const normalizedDateStr = getLocalDateString(editingDate);
    
    // Excluir o próprio agendamento em edição dos ocupados
    const currentAppointmentId = editingAppointment?.id;
    
    const q = query(
      collection(db, "agendamentos"),
      where("dateStr", "==", normalizedDateStr)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const map: Record<string, string[]> = {};
      querySnapshot.forEach((docSnap) => {
        // Ignorar o agendamento atual sendo editado
        if (docSnap.id === currentAppointmentId) return;
        
        const data = docSnap.data();
        const bId = data.barberId;
        let slots: string[] = [];
        if (data.timeSlots) {
          slots = data.timeSlots;
        } else if (data.timeSlot) {
          slots = [data.timeSlot];
        }
        if (map[bId]) {
          map[bId] = Array.from(new Set([...map[bId], ...slots]));
        } else {
          map[bId] = slots;
        }
      });
      setBookedSlotsByBarber(map);
    });
    
    return () => unsubscribe();
  }, [editingDate, editingAppointment?.id]);

  // Calcula os slots disponíveis quando mudam a data ou o barbeiro
  useEffect(() => {
    if (!editingDate || !editingBarber) {
      setAvailableSlots({ manha: [], tarde: [], noite: [] });
      return;
    }

    // Encontra o barbeiro selecionado completo com horários
    const selectedBarber = barberOptions.find(b => b.id === editingBarber.id);
    if (!selectedBarber) {
      setEditFeedback("Barbeiro não encontrado");
      setAvailableSlots({ manha: [], tarde: [], noite: [] });
      return;
    }

    // Determina o dia da semana
    const dayName = getDayName(editingDate);
    const dateStr = getLocalDateString(editingDate);

    // Verifica exceções
    const barberExceptions = selectedBarber.exceptions || [];
    const exception = barberExceptions.find((ex: any) => ex.date === dateStr);
    
    if (exception) {
      if (exception.status === "blocked") {
        setEditFeedback("Este dia está bloqueado para o barbeiro");
        setAvailableSlots({ manha: [], tarde: [], noite: [] });
        return;
      }
    }

    // Obtém a configuração de horário
    let dayConfig;
    
    if (exception?.status === "available" && exception.open && exception.close) {
      dayConfig = {
        open: exception.open,
        close: exception.close,
        active: true
      };
    } else {
      // Verificar configuração individual do barbeiro
      if (selectedBarber.horarios && selectedBarber.horarios[dayName]) {
        dayConfig = selectedBarber.horarios[dayName];
      } else {
        // Usa configuração global
        dayConfig = operatingHours?.[dayName] || null;
      }
    }

    if (!dayConfig || !dayConfig.active || !dayConfig.open || !dayConfig.close) {
      setEditFeedback("Não há configuração de horário para este dia");
      setAvailableSlots({ manha: [], tarde: [], noite: [] });
      return;
    }

    // Gera todos os slots possíveis
    const allSlots = generateSlots(
      dayConfig.open,
      dayConfig.breakStart,
      dayConfig.breakEnd,
      dayConfig.close,
      30
    );

    // Remove os slots já ocupados
    const bookedSlots = bookedSlotsByBarber[selectedBarber.id] || [];
    const availableTimeSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

    if (availableTimeSlots.length === 0) {
      setEditFeedback("Não há horários disponíveis para esta data");
      setAvailableSlots({ manha: [], tarde: [], noite: [] });
      return;
    }

    setAvailableSlots(groupSlots(availableTimeSlots));
    setEditFeedback("");
  }, [editingDate, editingBarber, bookedSlotsByBarber, barberOptions, operatingHours]);

  // Funções de Filtro: hoje, amanhã e limpar filtro para a listagem de agendamentos
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

  // Filtra os agendamentos existentes de acordo com a data selecionada
  const filteredAppointments = appointments.filter((appt) =>
    filterDate ? appt.dateStr === filterDate : true
  );

  // Handler para iniciar a edição de um agendamento
  const handleStartEditing = (appt: Appointment) => {
    setEditingAppointment({ ...appt });
    
    // Inicializa os estados de edição
    const [year, month, day] = appt.dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    setEditingDate(date);
    
    setEditingTimeSlot(appt.timeSlots?.[0] || "");
    setEditingService(appt.service);
    
    // Encontra o barbeiro correspondente
    const barber = barberOptions.find(b => b.id === appt.barberId);
    setEditingBarber(barber || null);
    
    setEditFeedback("");
  };

  // Handler para cancelar a edição
  const handleCancelEdit = () => {
    setEditingAppointment(null);
    setEditingDate(null);
    setEditingTimeSlot("");
    setEditingService("");
    setEditingBarber(null);
    setEditFeedback("");
  };

  // Handler para salvar a edição de um agendamento
  const handleSaveEdit = async () => {
    if (!editingAppointment || !editingDate || !editingTimeSlot || !editingService || !editingBarber) {
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
        setEditFeedback("Horário inicial não está disponível");
        return;
      }
      
      if (startIndex + slotsNeeded > allSlots.length) {
        setEditFeedback("Não há slots suficientes para completar este serviço");
        return;
      }
      
      // Verificar se os slots são consecutivos
      const requiredSlots = allSlots.slice(startIndex, startIndex + slotsNeeded);
      for (let i = 1; i < requiredSlots.length; i++) {
        const prevSlot = requiredSlots[i-1];
        const currSlot = requiredSlots[i];
        
        const [prevHour, prevMin] = prevSlot.split(":").map(Number);
        const [currHour, currMin] = currSlot.split(":").map(Number);
        
        const prevTotalMins = prevHour * 60 + prevMin;
        const currTotalMins = currHour * 60 + currMin;
        
        if (currTotalMins - prevTotalMins !== 30) {
          setEditFeedback("Os horários não são consecutivos (pode haver um intervalo entre eles)");
          return;
        }
      }
      
      const dateStr = getLocalDateString(editingDate);
      
      await updateDoc(doc(db, "agendamentos", editingAppointment.id), {
        dateStr: dateStr,
        timeSlots: requiredSlots,
        service: editingService,
        duration: service.duration,
        barber: editingBarber.name,
        barberId: editingBarber.id,
        status: editingAppointment.status,
      });
      
      handleCancelEdit();
      setFeedback("Agendamento atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      setEditFeedback("Erro ao salvar. Tente novamente.");
    }
  };

  // Handler para cancelar (excluir) um agendamento
  const handleCancelAppointment = async (appt: Appointment) => {
    if (!confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      await deleteDoc(doc(db, "agendamentos", appt.id));
      setFeedback("Agendamento cancelado com sucesso!");
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      setFeedback("Erro ao cancelar agendamento. Tente novamente.");
    }
  };

  if (loading || !user || loadingAppointments) {
    return <p>Carregando dados...</p>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Meus Agendamentos</h1>

        {/* Seção de Filtros */}
        <div className="mb-8 flex flex-wrap gap-4 items-center">
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
            className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Hoje
          </button>
          <button
            onClick={setTomorrowFilter}
            className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Amanhã
          </button>
          <button
            onClick={clearFilters}
            className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600 transition"
          >
            Limpar Filtro
          </button>
        </div>

        {/* Mensagem de feedback */}
        {feedback && <p className="mb-4 text-center text-yellow-300">{feedback}</p>}

        {/* Formulário de Edição */}
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
                    readOnly
                    className="px-3 py-2 bg-gray-200 w-full rounded"
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
                
                <div>
                  <label className="block mb-1">Barbeiro</label>
                  <select
                    value={editingBarber?.id || ""}
                    onChange={(e) => {
                      const selected = barberOptions.find(b => b.id === e.target.value);
                      setEditingBarber(selected || null);
                      setEditingTimeSlot("");
                    }}
                    className="px-3 py-2 bg-white border w-full rounded"
                  >
                    <option value="">Selecione um barbeiro</option>
                    {barberOptions.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {editingDate && editingBarber && (
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
                      <p className="text-red-500 mt-2">Não há horários disponíveis para esta data e barbeiro</p>
                    )}
                  </div>
                )}
                
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
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Listagem de Agendamentos */}
        {filteredAppointments.length === 0 ? (
          <p className="text-center">Nenhum agendamento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 border">Data</th>
                  <th className="px-4 py-2 border">Horário</th>
                  <th className="px-4 py-2 border">Serviço</th>
                  <th className="px-4 py-2 border">Barbeiro</th>
                  <th className="px-4 py-2 border">Status</th>
                  <th className="px-4 py-2 border">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((app) => (
                  <tr key={app.id}>
                    <td className="px-4 py-2 border">{formatDate(app.dateStr)}</td>
                    <td className="px-4 py-2 border">{app.timeSlot}</td>
                    <td className="px-4 py-2 border">{app.service}</td>
                    <td className="px-4 py-2 border">{app.barber}</td>
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
      </main>
      <Footer />
    </div>
  );
};

export default ClientAppointments;