"use client";

import React, { useState, useEffect } from "react";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useOperatingHours } from "@/hooks/useOperatingHours";
import errorMessages from "@/utils/errorMessages";
import { useServicos } from "@/hooks/useServicos";
import { useBarbeiros } from "@/hooks/useBarbeiros";
import { Agendamento } from '@/hooks/useAgendamentos';
import { OperatingHours, DayConfig, Exception } from "@/types/common";
import { useAgendamentosOperations } from '@/hooks/useAgendamentosOperations';

// ----------------------
// Helper Functions
// ----------------------

// Formata uma data no formato "YYYY-MM-DD"
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Retorna o nome do dia (em português) a partir da data
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
    // Verificação rigorosa do intervalo: pula slots que começam durante o intervalo
    // ou slots que terminam durante o intervalo, ou slots que englobam todo o intervalo
    if (breakStartTotal >= 0 && breakEndTotal > 0) {
      const slotEnd = time + interval;
      if (
        (time >= breakStartTotal && time < breakEndTotal) || // Slot começa durante o intervalo
        (slotEnd > breakStartTotal && slotEnd <= breakEndTotal) || // Slot termina durante o intervalo
        (time < breakStartTotal && slotEnd > breakEndTotal) // Slot contém todo o intervalo
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

// ----------------------
// Interfaces and Constants
// ----------------------

// Interface para configuração de um dia
export interface DayConfig {
  open?: string;
  close?: string;
  breakStart?: string;
  breakEnd?: string;
  active: boolean;
}

// OperatingHours: os dias estão definidos diretamente (sem wrapper "diasSemana")
export interface OperatingHours {
  domingo: DayConfig;
  segunda: DayConfig;
  terça: DayConfig;
  quarta: DayConfig;
  quinta: DayConfig;
  sexta: DayConfig;
  sábado: DayConfig;
}

export interface Exception {
  id?: string;
  date: string;
  status: 'blocked' | 'available';
  message?: string;
  open?: string;
  close?: string;
  breakStart?: string;
  breakEnd?: string;
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
interface Barber {
  id: string;
  name: string;
}

interface BarberWithSchedule extends Barber {
  // Em Firebase, o campo "horarios" contém os dias diretamente.
  horarios?: OperatingHours | null;
  // As exceções individuais para o barbeiro podem estar armazenadas apesar de não constar na interface original.
  exceptions?: any[];
}

// ----------------------
// Availability Calculation Functions
// ----------------------

// Função modificada para verificar primeiro se o barbeiro possui configuração individual e exceções armazenadas em seu documento.
// Se o barbeiro tiver um array de exceções (campo "exceptions"), ele será utilizado para verificar a data selecionada; caso contrário, usa-se o parâmetro globalExceptions.
function getEffectiveDayConfig(
  barber: BarberWithSchedule,
  date: Date,
  globalOperatingHours: OperatingHours,
  globalExceptions: any[]
): DayConfig | null {
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);
  
  console.log(`Verificando configuração para barbeiro ${barber.name} no dia ${normalizedDate} (${dayName})`);
  console.log(`Horários do barbeiro:`, barber.horarios);

  // Primeiro verificar exceções do barbeiro (têm maior prioridade)
  if (barber.exceptions && barber.exceptions.length > 0) {
    const exception = barber.exceptions.find((ex) => ex.date === normalizedDate);
    if (exception) {
      console.log(`Exceção encontrada para ${barber.name} no dia ${normalizedDate}:`, exception);
      
      if (exception.status === "blocked") {
        console.log(`Dia bloqueado por exceção para ${barber.name}.`);
        return null;
      }
      
      if (exception.status === "available" && exception.open && exception.close) {
        console.log(`Dia habilitado por exceção para ${barber.name}: ${exception.open}-${exception.close}`);
        return { 
          open: exception.open, 
          close: exception.close, 
          breakStart: exception.breakStart, 
          breakEnd: exception.breakEnd, 
          active: true 
        };
      }
    }
  }
  
  // Depois verificar exceções globais
  const globalException = globalExceptions.find((ex) => ex.date === normalizedDate);
  if (globalException) {
    console.log(`Exceção global encontrada para ${normalizedDate}:`, globalException);
    
    if (globalException.status === "blocked") {
      console.log(`Dia bloqueado por exceção global.`);
      return null;
    }
    
    if (globalException.status === "available" && globalException.open && globalException.close) {
      console.log(`Dia habilitado por exceção global: ${globalException.open}-${globalException.close}`);
      return { 
        open: globalException.open, 
        close: globalException.close, 
        breakStart: globalException.breakStart, 
        breakEnd: globalException.breakEnd, 
        active: true 
      };
    }
  }

  // Em seguida, verificar configuração individual do barbeiro
  if (barber.horarios && barber.horarios[dayName]) {
    const individualConfig = barber.horarios[dayName];
    console.log(`Configuração individual encontrada para ${barber.name}:`, individualConfig);
    
    if (individualConfig.active && individualConfig.open && individualConfig.close) {
      console.log(`Usando configuração individual para ${barber.name}`);
      return individualConfig;
    } else if (individualConfig.active === false) {
      console.log(`Dia desativado na configuração individual de ${barber.name}`);
      return null;
    }
    // Se a configuração individual existir mas não for ativa ou completa, continue para global
  }

  // Por último, usar configuração global
  const globalConfig = globalOperatingHours[dayName];
  if (globalConfig && globalConfig.active && globalConfig.open && globalConfig.close) {
    console.log(`Usando configuração global para ${barber.name}`);
    return globalConfig;
  } else {
    console.log(`Configuração global indisponível ou incompleta para ${dayName}`);
    return null;
  }
}
// A partir dos free slots individuais de cada barbeiro disponível (fullSlots menos os slots reservados),
// retorna a união desses free slots para o dia.
function getUnionFreeSlots(
  date: Date,
  availableBarbers: BarberWithSchedule[],
  globalOperatingHours: OperatingHours,
  globalExceptions: any[],
  bookedSlotsMap: Record<string, string[]>
): string[] {
  // Usar Set para armazenar os slots únicos
  const unionSet = new Set<string>();
  
  // Verifique se há algum barbeiro disponível
  if (availableBarbers.length === 0) {
    console.log("Nenhum barbeiro disponível para a data");
    return [];
  }
  
  availableBarbers.forEach((barber) => {
    // Obtém a configuração efetiva para este barbeiro
    const effectiveConfig = getEffectiveDayConfig(
      barber,
      date,
      globalOperatingHours,
      globalExceptions
    );
    
    if (effectiveConfig && effectiveConfig.open && effectiveConfig.close) {
      // Gera todos os slots possíveis para este barbeiro
      const fullSlots = generateSlots(
        effectiveConfig.open,
        effectiveConfig.breakStart,
        effectiveConfig.breakEnd,
        effectiveConfig.close,
        30
      );
      
      // Remove os slots já reservados
      const booked = bookedSlotsMap[barber.id] || [];
      const freeSlots = fullSlots.filter((slot) => !booked.includes(slot));
      
      console.log(`Free slots for ${barber.name}:`, freeSlots);
      
      // Adiciona os slots livres ao conjunto de união
      freeSlots.forEach((slot) => unionSet.add(slot));
    } else {
      console.log(`Configuração inválida para ${barber.name} na data ${getLocalDateString(date)}`);
    }
  });
  
  // Converte o Set para array e ordena
  const unionArray = Array.from(unionSet).sort();
  console.log(`Union of free slots for ${getLocalDateString(date)}:`, unionArray);
  
  return unionArray;
}

// ----------------------
// Agendamento Component
// ----------------------

const Agendamento: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { operatingHours, exceptions } = useOperatingHours();
  // Adicionar essa linha - chamar o hook no nível superior
  const { createAgendamento } = useAgendamentosOperations();

  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<{
    name: string;
    duration: number;
    value: number;
  } | null>(null);
  const [serviceOptions, setServiceOptions] = useState<
    { name: string; duration: number; value: number }[]
  >([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | "Qualquer" | "">("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [barberList, setBarberList] = useState<BarberWithSchedule[]>([]);
  const [computedSlots, setComputedSlots] = useState<{
    manha: string[];
    tarde: string[];
    noite: string[];
  }>({ manha: [], tarde: [], noite: [] });
  // Mapeia cada barberId para os slots já reservados
  const [bookedSlotsByBarber, setBookedSlotsByBarber] = useState<Record<string, string[]>>({});

  // States para configuração individual, se um barbeiro específico for selecionado
  const [indivOperatingHours, setIndivOperatingHours] = useState<OperatingHours | null>(null);
  const [indivExceptions, setIndivExceptions] = useState<any[]>([]);
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUserData() {
      if (user && !loading) {
        try {
          const userDocRef = doc(db, "usuarios", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserName(data.name || "");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    }
    fetchUserData();
  }, [user, loading]);

  const { servicos, loading: servicosLoading } = useServicos();
  const { barbeiros, loading: barbeirosLoading } = useBarbeiros();

  useEffect(() => {
    if (!servicosLoading) {
      setServiceOptions(servicos);
    }
  }, [servicos, servicosLoading]);

  useEffect(() => {
    if (!barbeirosLoading) {
      setBarberList(barbeiros);
    }
  }, [barbeiros, barbeirosLoading]);

  useEffect(() => {
    if (selectedBarber !== "Qualquer" && selectedBarber !== "") {
      const barberId = (selectedBarber as Barber).id;
      const barberDocRef = doc(db, "usuarios", barberId);
      getDoc(barberDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.horarios) {
              setIndivOperatingHours(data.horarios);
              setIndivExceptions(data.exceptions || []);
            } else {
              setIndivOperatingHours(null);
              setIndivExceptions([]);
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching individual barber config:", error);
          setIndivOperatingHours(null);
          setIndivExceptions([]);
        });
    } else {
      setIndivOperatingHours(null);
      setIndivExceptions([]);
    }
  }, [selectedBarber]);

  const currentOperatingHours =
    selectedBarber !== "Qualquer" && indivOperatingHours ? indivOperatingHours : operatingHours;
  const currentExceptions =
    selectedBarber !== "Qualquer" && indivExceptions.length > 0 ? indivExceptions : exceptions;
  const effectiveOperatingHours: OperatingHours = currentOperatingHours || defaultOperatingHours;
  const effectiveExceptions: any[] = currentExceptions || [];

  // Atualiza os agendamentos do dia para TODOS os barbeiros
  useEffect(() => {
    if (!selectedDate) return;
    const normalizedDateStr = getLocalDateString(selectedDate);
    const q = query(
      collection(db, "agendamentos"),
      where("dateStr", "==", normalizedDateStr)
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const map: Record<string, string[]> = {};
      querySnapshot.forEach((docSnap) => {
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
  }, [selectedDate]);

  // Calcula os free slots (computedSlots)
useEffect(() => {
  if (!selectedDate) {
    setComputedSlots({ manha: [], tarde: [], noite: [] });
    return;
  }
  
  console.log("Calculando slots para:", getLocalDateString(selectedDate));
  console.log("Barbeiro selecionado:", selectedBarber);
  
  // Configuração efetiva a usar
  const effectiveGlobalOperatingHours = operatingHours || defaultOperatingHours;
  const effectiveGlobalExceptions = exceptions || [];
  
  if (selectedBarber === "Qualquer") {
    // Primeiro, verificar se existem barbeiros disponíveis neste dia
    console.log("Verificando barbeiros disponíveis...", barberList.length);
    
    // Obtenha a lista de barbeiros que estão disponíveis neste dia
    // usando a configuração global ou individual de cada um
    const availableBarbers = barberList.filter((b) => {
      const config = getEffectiveDayConfig(
        b, 
        selectedDate, 
        effectiveGlobalOperatingHours, 
        effectiveGlobalExceptions
      );
      return config !== null;
    });
    
    console.log("Barbeiros disponíveis:", availableBarbers.map(b => b.name));
    
    if (availableBarbers.length === 0) {
      setFeedback("O agendamento não está disponível para a data selecionada.");
      setComputedSlots({ manha: [], tarde: [], noite: [] });
      return;
    }
    
    // Obtenha a união de todos os slots disponíveis
    const unionFreeSlots = getUnionFreeSlots(
      selectedDate,
      availableBarbers,
      effectiveGlobalOperatingHours,
      effectiveGlobalExceptions,
      bookedSlotsByBarber
    );
    
    console.log("Slots unidos disponíveis:", unionFreeSlots);
    
    if (unionFreeSlots.length === 0) {
      setFeedback("Não há horários disponíveis para a data selecionada.");
      setComputedSlots({ manha: [], tarde: [], noite: [] });
      return;
    }
    
    setComputedSlots(groupSlots(unionFreeSlots));
    setFeedback("");
  } else {
    const specificBarber = selectedBarber as BarberWithSchedule;
    
    // Obtenha a configuração efetiva para este barbeiro
    const effectiveConfig = getEffectiveDayConfig(
      specificBarber,
      selectedDate,
      effectiveGlobalOperatingHours,
      effectiveExceptions
    );
    
    if (!effectiveConfig) {
      setFeedback("O agendamento não está disponível para a data selecionada para o barbeiro escolhido.");
      setComputedSlots({ manha: [], tarde: [], noite: [] });
      return;
    }
    
    console.log("Configuração efetiva para barbeiro específico:", effectiveConfig);
    
    const fullSlots = generateSlots(
      effectiveConfig.open!,
      effectiveConfig.breakStart,
      effectiveConfig.breakEnd,
      effectiveConfig.close!,
      30
    );
    
    console.log("Slots completos gerados:", fullSlots);
    
    const barberBooked = bookedSlotsByBarber[specificBarber.id] || [];
    console.log("Slots já reservados:", barberBooked);
    
    const free = fullSlots.filter((slot) => !barberBooked.includes(slot));
    console.log("Slots disponíveis:", free);
    
    if (free.length === 0) {
      setFeedback("Não há horários disponíveis para a data selecionada.");
      setComputedSlots({ manha: [], tarde: [], noite: [] });
      return;
    }
    
    setComputedSlots(groupSlots(free));
    setFeedback("");
  }
}, [selectedDate, selectedBarber, barberList, bookedSlotsByBarber, operatingHours, exceptions, effectiveExceptions]);

  const handleNext = () => {
    if (step === 1 && !selectedService) {
      setFeedback("Por favor, selecione um serviço.");
      return;
    }
    if (step === 2 && !selectedBarber) {
      setFeedback("Por favor, selecione um barbeiro (ou 'Qualquer Barbeiro').");
      return;
    }
    setFeedback("");
    setStep(step + 1);
  };

  const handleBack = () => {
    setFeedback("");
    setStep(step - 1);
  };

  const saveAppointment = async (selectedBarber: Barber, requiredSlots: string[]) => {
    try {
      const result = await createAgendamento({
        uid: user.uid,
        email: user.email,
        name: user.name || userName,
        service: selectedService.name,
        duration: selectedService.duration,
        barber: selectedBarber.name,
        barberId: selectedBarber.id,
        dateStr: getLocalDateString(selectedDate),
        timeSlots: requiredSlots,
        createdAt: new Date(),
        status: "confirmado"
      });
      
      if (!result.success) {
        setFeedback(result.error || "Erro ao salvar agendamento");
      }
      return result.success;
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      setFeedback("Erro ao processar o agendamento. Por favor, tente novamente.");
      return false;
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTimeSlot || !selectedService) {
      setFeedback("Preencha todos os campos obrigatórios.");
      return;
    }
    
    // Declare variáveis para os horários e os intervalos
    let openTime: string | undefined;
    let closeTime: string | undefined;
    let breakStartTime: string | undefined;
    let breakEndTime: string | undefined;
  
    const normalized = getLocalDateString(selectedDate);
    const dayName = getDayName(selectedDate);
    
    // Verificar se há alguma exceção para esta data
    const exception = effectiveExceptions.find(
      (ex) =>
        ex.date === normalized &&
        ex.status === "available" &&
        ex.open &&
        ex.close
    );
    
    if (exception) {
      openTime = exception.open;
      closeTime = exception.close;
      breakStartTime = undefined;
      breakEndTime = undefined;
    } else {
      if (selectedBarber === "Qualquer") {
        // Para "Qualquer Barbeiro", vamos verificar se há pelo menos um barbeiro disponível
        // Se chegamos aqui, significa que já mostramos os slots, então sabemos que há barbeiros disponíveis
        const availableBarbeiros = barberList.filter((b) => 
          getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions || [])
        );
        
        if (availableBarbeiros.length === 0) {
          setFeedback("Não há barbeiros disponíveis nesta data.");
          return;
        }
        
        // Usamos a configuração do primeiro barbeiro disponível para validação inicial
        // Isso é apenas para seguir com a validação, depois encontraremos o melhor barbeiro
        const firstAvailable = availableBarbeiros[0];
        const firstConfig = getEffectiveDayConfig(
          firstAvailable, 
          selectedDate, 
          operatingHours || defaultOperatingHours, 
          exceptions || []
        );
        
        if (!firstConfig || !firstConfig.open || !firstConfig.close) {
          setFeedback("Horários não configurados para o dia selecionado.");
          return;
        }
        
        openTime = firstConfig.open;
        closeTime = firstConfig.close;
        breakStartTime = firstConfig.breakStart;
        breakEndTime = firstConfig.breakEnd;
      } else {
        // Para um barbeiro específico, usamos a configuração normal
        const dayConfig = effectiveOperatingHours[dayName];
        
        if (!dayConfig || !dayConfig.active) {
          setFeedback("Este dia não está disponível para agendamento.");
          return;
        }
        
        if (!dayConfig.open || !dayConfig.close) {
          setFeedback("Horários não configurados para o dia selecionado.");
          return;
        }
        
        openTime = dayConfig.open;
        closeTime = dayConfig.close;
        breakStartTime = dayConfig.breakStart;
        breakEndTime = dayConfig.breakEnd;
      }
    }
    
    if (!openTime || !closeTime) {
      setFeedback("Horários não configurados para o dia selecionado.");
      return;
    }
    
    // O resto da função permanece igual...
    
    // Agora geramos todos os slots disponíveis
    const dynamicSlots = generateSlots(openTime, breakStartTime, breakEndTime, closeTime, 30);
    
    // Calcula quantos slots são necessários para o serviço
    const slotsNeeded = Math.ceil(selectedService.duration / 30);
    
    // Verifica se o slot selecionado existe e se há slots suficientes após ele
    const index = dynamicSlots.indexOf(selectedTimeSlot);
    if (index === -1) {
      setFeedback(errorMessages.slotNotAvailable);
      return;
    }
    
    if (index + slotsNeeded > dynamicSlots.length) {
      setFeedback(errorMessages.serviceExceedsClosing);
      return;
    }
    
    // Verifica se todos os slots necessários estão consecutivos e disponíveis
    const requiredSlots = dynamicSlots.slice(index, index + slotsNeeded);
    
    // Verifica a continuidade (não quebrados por intervalo)
    for (let i = 1; i < requiredSlots.length; i++) {
      const prevSlot = requiredSlots[i-1];
      const currSlot = requiredSlots[i];
      
      const [prevHour, prevMin] = prevSlot.split(":").map(Number);
      const [currHour, currMin] = currSlot.split(":").map(Number);
      
      const prevTotalMins = prevHour * 60 + prevMin;
      const currTotalMins = currHour * 60 + currMin;
      
      if (currTotalMins - prevTotalMins !== 30) {
        setFeedback(errorMessages.serviceCrossesBreak);
        return;
      }
    }
    
    if (selectedBarber !== "Qualquer") {
      // Verifica se os slots estão disponíveis para o barbeiro específico
      const barberBooked = bookedSlotsByBarber[(selectedBarber as Barber).id] || [];
      
      if (requiredSlots.some(slot => barberBooked.includes(slot))) {
        setFeedback("Um ou mais horários necessários já estão ocupados para este barbeiro.");
        return;
      }
      
      await saveAppointment(selectedBarber as Barber, requiredSlots);
    } else {
      // Para "Qualquer Barbeiro", encontre um que tenha todos os slots disponíveis
      const availableBarbeiros = barberList.filter((b) => 
        getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions || [])
      );
      
      let availableBarber: BarberWithSchedule | null = null;
      
      for (const barber of availableBarbeiros) {
        const effectiveConfig = getEffectiveDayConfig(
          barber,
          selectedDate,
          operatingHours || defaultOperatingHours,
          exceptions || []
        );
        
        if (!effectiveConfig || !effectiveConfig.open || !effectiveConfig.close) continue;
        
        // Gera os slots específicos deste barbeiro
        const barberSlots = generateSlots(
          effectiveConfig.open,
          effectiveConfig.breakStart,
          effectiveConfig.breakEnd,
          effectiveConfig.close,
          30
        );
        
        // Verifica se o slot inicial existe nos slots deste barbeiro
        const startIndex = barberSlots.indexOf(selectedTimeSlot);
        if (startIndex === -1 || startIndex + slotsNeeded > barberSlots.length) continue;
        
        // Verifica se todos os slots estão disponíveis e consecutivos
        const requiredForBarber = barberSlots.slice(startIndex, startIndex + slotsNeeded);
        
        // Verifica a continuidade (não quebrados por intervalo)
        let isContinuous = true;
        for (let i = 1; i < requiredForBarber.length; i++) {
          const prevSlot = requiredForBarber[i-1];
          const currSlot = requiredForBarber[i];
          
          const [prevHour, prevMin] = prevSlot.split(":").map(Number);
          const [currHour, currMin] = currSlot.split(":").map(Number);
          
          const prevTotalMins = prevHour * 60 + prevMin;
          const currTotalMins = currHour * 60 + currMin;
          
          if (currTotalMins - prevTotalMins !== 30) {
            isContinuous = false;
            break;
          }
        }
        
        if (!isContinuous) continue;
        
        // Verifica se algum slot já está ocupado
        const booked = bookedSlotsByBarber[barber.id] || [];
        if (requiredForBarber.some((slot) => booked.includes(slot))) continue;
        
        availableBarber = barber;
        break;
      }
      
      if (!availableBarber) {
        setFeedback("Não há barbeiros disponíveis para todos os horários necessários. Selecione outro horário.");
        return;
      }
      
      await saveAppointment(availableBarber, requiredSlots);
    }
    
    setShowPopup(true);
    setTimeout(() => {
      router.push("/");
    }, 2000);
  };  

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      {showPopup && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white text-black p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-center">
              Agendamento realizado com sucesso!
            </h2>
          </div>
        </div>
      )}
      <main className="py-20 px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Agendamento</h1>
        <div className="max-w-3xl mx-auto bg-gray-900 p-4 rounded shadow mb-6">
          <p className="text-lg text-center">
            Agendamento para:{" "}
            <strong>{userName || user?.email || "Usuário desconhecido"}</strong>
          </p>
        </div>
        <div className="max-w-3xl mx-auto bg-gray-900 p-6 rounded shadow">
          {step === 1 && (
            <>
              <h2 className="text-xl mb-4">Selecione o Serviço</h2>
              <div>
                <select
                  value={selectedService ? selectedService.name : ""}
                  onChange={(e) => {
                    const serviceName = e.target.value;
                    const serv = serviceOptions.find((s) => s.name === serviceName);
                    setSelectedService(serv || null);
                  }}
                  className="w-full px-3 py-2 border rounded bg-white text-black"
                >
                  <option value="">Selecione um serviço</option>
                  {serviceOptions.map((s, idx) => (
                    <option key={idx} value={s.name}>
                      {s.name} ({s.duration} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={handleNext} className="bg-blue-500 text-white px-4 py-2 rounded">
                  Próximo
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-xl mb-4">Selecione o Barbeiro</h2>
              <div className="space-y-2">
                {barberList.length > 0 ? (
                  barberList.map((barber) => (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setSelectedBarber(barber)}
                      className={`w-full p-2 border rounded ${
                        typeof selectedBarber === "object" && selectedBarber.id === barber.id
                          ? "bg-blue-500 text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      {barber.name}
                    </button>
                  ))
                ) : (
                  <p>Nenhum barbeiro encontrado.</p>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedBarber("Qualquer")}
                  className={`w-full p-2 border rounded ${
                    selectedBarber === "Qualquer" ? "bg-blue-500 text-white" : "bg-white text-black"
                  }`}
                >
                  Qualquer Barbeiro
                </button>
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={handleBack} className="bg-gray-500 text-white px-4 py-2 rounded">
                  Voltar
                </button>
                <button onClick={handleNext} className="bg-blue-500 text-white px-4 py-2 rounded">
                  Próximo
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <h2 className="text-xl mb-4">Selecione Data e Hora</h2>
              <div>
                <label className="block mb-1">Selecione a Data</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date: Date | null) => {
                    setSelectedDate(date);
                    setSelectedTimeSlot("");
                    setFeedback("");
                  }}
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  className="border px-3 py-2 rounded w-full"
                  placeholderText="Selecione uma data"
                  required
                />
              </div>
              {selectedDate && (
                <>
                  <h3 className="text-lg mt-4">Horários Disponíveis</h3>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {Object.entries(computedSlots).map(([periodKey, slots]) => (
                      <div key={periodKey}>
                        <h4 className="font-bold capitalize">
                          {periodKey === "manha" ? "manhã" : periodKey === "tarde" ? "tarde" : "noite"}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {slots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                setSelectedTimeSlot(slot);
                                setFeedback("");
                              }}
                              className={`px-3 py-1 border rounded ${
                                selectedTimeSlot === slot ? "bg-blue-500 text-white" : "bg-white text-black"
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Confirmar Agendamento
                </button>
              </div>
              {feedback && (
                <p className="mt-4 text-center text-red-500">{feedback}</p>
              )}
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Agendamento;
