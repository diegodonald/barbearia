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
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useOperatingHours } from "@/hooks/useOperatingHours";

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
  for (let time = startTotal; time <= endTotal; time += interval) {
    // Se os horários de intervalo forem definidos e o slot cair dentro (inclusive) desse período, pula-o
    if (
      breakStartTotal >= 0 &&
      breakEndTotal > 0 &&
      time >= breakStartTotal &&
      time <= breakEndTotal
    ) {
      continue;
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
interface DayConfig {
  open?: string;
  breakStart?: string;
  breakEnd?: string;
  close?: string;
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

  // Se houver configuração individual definida (horarios) para o dia, use-a.
  let individualConfig: DayConfig | null = null;
  if (barber.horarios && barber.horarios[dayName] !== undefined) {
    individualConfig = barber.horarios[dayName];
    console.log(`Barber ${barber.name}: Using individual config for ${dayName} (${normalizedDate}).`);
  }

  // Verificar exceções: priorize as exceções do barbeiro (armazenadas no campo "exceptions") se existirem,
  // caso contrário, utilize as exceções globais.
  const effectiveExceptions = barber.exceptions && barber.exceptions.length > 0 ? barber.exceptions : globalExceptions;
  if (effectiveExceptions) {
    const exception = effectiveExceptions.find((ex: any) => ex.date === normalizedDate);
    if (exception) {
      console.log(`Exception for ${barber.name} on ${normalizedDate}:`, exception);
      if (exception.status === "blocked") {
        console.log(`Day ${normalizedDate} blocked by exception.`);
        return null;
      }
      if (exception.status === "available" && exception.open && exception.close) {
        console.log(`Day ${normalizedDate} opened by exception: ${exception.open} - ${exception.close}`);
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

// A partir dos free slots individuais de cada barbeiro disponível (fullSlots menos os slots reservados),
// retorna a união desses free slots para o dia.
function getUnionFreeSlots(
  date: Date,
  availableBarbers: BarberWithSchedule[],
  globalOperatingHours: OperatingHours,
  globalExceptions: any[],
  bookedSlotsMap: Record<string, string[]>
): string[] {
  const unionSet = new Set<string>();
  availableBarbers.forEach((barber) => {
    const effectiveConfig = getEffectiveDayConfig(
      barber,
      date,
      globalOperatingHours,
      globalExceptions
    );
    if (effectiveConfig) {
      const fullSlots = generateSlots(
  effectiveConfig.open!,
  effectiveConfig.breakStart,
  effectiveConfig.breakEnd,
  effectiveConfig.close!,
  30
);
      const booked = bookedSlotsMap[barber.id] || [];
      const freeSlots = fullSlots.filter((slot) => !booked.includes(slot));
      console.log(`Free slots for ${barber.name}:`, freeSlots);
      freeSlots.forEach((slot) => unionSet.add(slot));
    }
  });
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

  useEffect(() => {
    async function fetchBarbers() {
      try {
        const q = query(collection(db, "usuarios"), where("role", "==", "barber"));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name as string,
            horarios: data.horarios || null,
            exceptions: data.exceptions || [] // Adiciona as exceções do barbeiro
          } as BarberWithSchedule;
        });
        setBarberList(list);
      } catch (error) {
        console.error("Error fetching barbers:", error);
      }
    }
    fetchBarbers();
  }, []);

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
        console.error("Error fetching services:", error);
      }
    }
    fetchServiceOptions();
  }, []);

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
    if (selectedBarber === "Qualquer") {
      const availableBarbers = barberList.filter((b) =>
        getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions)
      );
      if (availableBarbers.length === 0) {
        setFeedback("O agendamento não está disponível para a data selecionada.");
        setComputedSlots({ manha: [], tarde: [], noite: [] });
        return;
      }
      const unionFreeSlots = getUnionFreeSlots(
        selectedDate,
        availableBarbers,
        operatingHours || defaultOperatingHours,
        exceptions,
        bookedSlotsByBarber
      );
      setComputedSlots(groupSlots(unionFreeSlots));
    } else {
      const specificBarber = selectedBarber as BarberWithSchedule;
      const effectiveConfig = getEffectiveDayConfig(
        specificBarber,
        selectedDate,
        operatingHours || defaultOperatingHours,
        effectiveExceptions
      );
      if (!effectiveConfig) {
        setFeedback("O agendamento não está disponível para a data selecionada para o barbeiro escolhido.");
        setComputedSlots({ manha: [], tarde: [], noite: [] });
        return;
      }
      const fullSlots = generateSlots(
  effectiveConfig.open!,
  effectiveConfig.breakStart,
  effectiveConfig.breakEnd,
  effectiveConfig.close!,
  30
);
      const barberBooked = bookedSlotsByBarber[specificBarber.id] || [];
      const free = fullSlots.filter((slot) => !barberBooked.includes(slot));
      setComputedSlots(groupSlots(free));
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

  const saveAppointment = async (assignedBarber: Barber, slots: string[]) => {
    if (!selectedDate) return;
    const normalizedDateStr = getLocalDateString(selectedDate);
    try {
      await addDoc(collection(db, "agendamentos"), {
        uid: user!.uid,
        email: user!.email,
        name: userName,
        service: selectedService?.name,
        duration: selectedService?.duration,
        barber: assignedBarber.name,
        barberId: assignedBarber.id,
        dateStr: normalizedDateStr,
        timeSlots: slots,
        createdAt: new Date(),
      });
      setFeedback("Agendamento salvo com sucesso!");
    } catch (error) {
      console.error("Error saving appointment:", error);
      setFeedback("Erro ao salvar agendamento. Tente novamente.");
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      setFeedback("Por favor, selecione uma data.");
      return;
    }
    if (!selectedTimeSlot) {
      setFeedback("Por favor, selecione um horário.");
      return;
    }
    if (!selectedService) {
      setFeedback("Serviço não selecionado.");
      return;
    }
// Declare variáveis para os horários e os intervalos
let openTime: string | undefined;
let closeTime: string | undefined;
let breakStartTime: string | undefined;
let breakEndTime: string | undefined;

const normalized = getLocalDateString(selectedDate);
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
  // Se houver exceção, você pode optar por não usar intervalos
  breakStartTime = undefined;
  breakEndTime = undefined;
} else {
  const dayName = getDayName(selectedDate);
  if (selectedBarber !== "Qualquer") {
    const dayConfig = effectiveOperatingHours[dayName];
    if (!dayConfig) {
      setFeedback("Horários não configurados para o dia selecionado.");
      return;
    }
    if (dayConfig.active && dayConfig.open && dayConfig.close) {
      openTime = dayConfig.open;
      closeTime = dayConfig.close;
      // Inclui os campos de intervalo, se configurados
      breakStartTime = dayConfig.breakStart;
      breakEndTime = dayConfig.breakEnd;
    }
  } else {
    // Se "Qualquer Barbeiro", a lógica pode vir de uma união de configurações individuais,
    // mas para o caso de confirmar o agendamento, verifique um dos modos ou defina a partir do global.
    // Por simplicidade, usaremos a configuração global do dia.
    const globalConfig = effectiveOperatingHours[getDayName(selectedDate)];
    if (globalConfig && globalConfig.active && globalConfig.open && globalConfig.close) {
      openTime = globalConfig.open;
      closeTime = globalConfig.close;
      breakStartTime = globalConfig.breakStart;
      breakEndTime = globalConfig.breakEnd;
    }
  }
}
if (!openTime || !closeTime) {
  setFeedback("Horários não configurados para o dia selecionado.");
  return;
}
// Agora a chamada passa os 5 argumentos:
const dynamicSlots = generateSlots(openTime, breakStartTime, breakEndTime, closeTime, 30);
    const slotsNeeded = Math.ceil(selectedService.duration / 30);
    const index = dynamicSlots.indexOf(selectedTimeSlot);
    if (index === -1 || index + slotsNeeded > dynamicSlots.length) {
      setFeedback("O horário selecionado não permite o serviço completo.");
      return;
    }
    const requiredSlots = dynamicSlots.slice(index, index + slotsNeeded);
    if (selectedBarber !== "Qualquer") {
      await saveAppointment(selectedBarber as Barber, requiredSlots);
    } else {
      const availableBarbeiros = barberList.filter((b) =>
        getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions)
      );
      let availableBarber: BarberWithSchedule | null = null;
      const slotsNeeded = Math.ceil(selectedService.duration / 30);
      for (const barber of availableBarbeiros) {
        const effectiveConfig = getEffectiveDayConfig(
          barber,
          selectedDate,
          operatingHours || defaultOperatingHours,
          exceptions
        );
        if (!effectiveConfig) continue;
        const fullSlots = generateSlots(
  effectiveConfig.open!,
  effectiveConfig.breakStart,
  effectiveConfig.breakEnd,
  effectiveConfig.close!,
  30
);
        const startIndex = fullSlots.indexOf(selectedTimeSlot);
        if (startIndex === -1 || startIndex + slotsNeeded > fullSlots.length) continue;
        const requiredForBarber = fullSlots.slice(startIndex, startIndex + slotsNeeded);
        const booked = bookedSlotsByBarber[barber.id] || [];
        if (requiredForBarber.some((slot) => booked.includes(slot))) continue;
        availableBarber = barber;
        break;
      }
      if (!availableBarber) {
        setFeedback("Horário não disponível. Selecione outro horário.");
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