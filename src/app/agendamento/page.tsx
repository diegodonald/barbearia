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
// Helpers e Funções Básicas
// ----------------------

// Formata uma data no formato "YYYY-MM-DD"
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Retorna o nome do dia da semana em português
function getDayName(date: Date): keyof OperatingHours {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return days[date.getDay()] as keyof OperatingHours;
}

// Gera os slots de horário para um intervalo, considerando o intervalo em minutos
function generateSlots(start: string, end: string, interval: number): string[] {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const slots: string[] = [];
  for (let time = startTotal; time <= endTotal; time += interval) {
    const hour = Math.floor(time / 60);
    const minute = time % 60;
    slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
  }
  return slots;
}

// Agrupa os slots em períodos: manhã, tarde e noite
function groupSlots(slots: string[]): { manha: string[]; tarde: string[]; noite: string[] } {
  const manha = slots.filter((slot) => slot < "12:00");
  const tarde = slots.filter((slot) => slot >= "12:00" && slot < "17:00");
  const noite = slots.filter((slot) => slot >= "17:00");
  return { manha, tarde, noite };
}

// ----------------------
// Interfaces e Constantes
// ----------------------

// Interface para um dia
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

// Atualize a interface OperatingHours para os dias diretamente, sem "diasSemana"
export interface OperatingHours {
  domingo: DayConfig;
  segunda: DayConfig;
  terça: DayConfig;
  quarta: DayConfig;
  quinta: DayConfig;
  sexta: DayConfig;
  sábado: DayConfig;
}

// Configuração global padrão (sem a chave "diasSemana")
const defaultOperatingHours: OperatingHours = {
  segunda: { open: "08:00", close: "18:00", active: true },
  terça: { open: "08:00", close: "18:00", active: true },
  quarta: { open: "08:00", close: "18:00", active: true },
  quinta: { open: "08:00", close: "18:00", active: true },
  sexta: { open: "08:00", close: "18:00", active: true },
  sábado: { open: "09:00", close: "14:00", active: true },
  domingo: { active: false },
};

interface Barber {
  id: string;
  name: string;
}

interface BarberWithSchedule extends Barber {
  // No Firebase, o objeto "horarios" tem os dias diretamente. Se não houver, será null.
  horarios?: OperatingHours | null;
}

// ----------------------
// Novas Funções para Calcular a Disponibilidade Efetiva
// ----------------------

// Retorna a configuração efetiva para um barbeiro na data específica, considerando a configuração individual e exceções globais.
// Logs foram adicionados para facilitar a depuração.
function getEffectiveDayConfig(
  barber: BarberWithSchedule,
  date: Date,
  globalOperatingHours: OperatingHours,
  globalExceptions: any[]
): DayConfig | null {
  console.log(`Calculando configuração para barbeiro: ${barber.name}`, barber);
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);
  let config: DayConfig | undefined;

  // Verifica se há configuração individual usando a nova estrutura
  if (barber.horarios && barber.horarios[dayName] !== undefined) {
    config = barber.horarios[dayName];
    console.log(`Barbeiro ${barber.name}: Encontrada configuração individual para ${dayName} (${normalizedDate}):`, config);
  } else {
    console.log(`Barbeiro ${barber.name}: Configuração individual NÃO encontrada para ${dayName} (${normalizedDate}). Usando global.`);
    config = globalOperatingHours[dayName];
    console.log(`Barbeiro ${barber.name}: Configuração global para ${dayName} (${normalizedDate}):`, config);
  }

  // Aplica exceção global, se existir
  const exception = globalExceptions.find((ex: any) => ex.date === normalizedDate);
  if (exception) {
    console.log(`Exceção para ${barber.name} no dia ${normalizedDate}:`, exception);
    if (exception.status === "blocked") {
      console.log(`Dia ${normalizedDate} bloqueado por exceção.`);
      return null;
    }
    if (exception.status === "available" && exception.open && exception.close) {
      console.log(`Dia ${normalizedDate} liberado por exceção: ${exception.open} - ${exception.close}`);
      return { open: exception.open, close: exception.close, active: true };
    }
  }

  if (!config || !config.active || !config.open || !config.close) {
    console.log(`Configuração inválida para ${barber.name} no dia ${dayName}:`, config);
    return null;
  }

  console.log(`Configuração efetiva para ${barber.name} no dia ${dayName}:`, config);
  return config;
}

// Gera a união dos slots disponíveis considerando somente os barbeiros disponíveis na data
function getUnionSlotsForDate(
  date: Date,
  barberList: BarberWithSchedule[],
  globalOperatingHours: OperatingHours | null,
  globalExceptions: any[]
): string[] {
  const unionSet = new Set<string>();
  barberList.forEach((barber) => {
    const effectiveConfig = getEffectiveDayConfig(
      barber,
      date,
      globalOperatingHours || defaultOperatingHours,
      globalExceptions
    );
    if (effectiveConfig) {
      const slots = generateSlots(effectiveConfig.open!, effectiveConfig.close!, 30);
      console.log(`Slots para ${barber.name} em ${getDayName(date)} (${getLocalDateString(date)}):`, slots);
      slots.forEach((slot) => unionSet.add(slot));
    }
  });
  const unionArray = Array.from(unionSet).sort();
  console.log(`UnionSlots para a data ${getLocalDateString(date)}:`, unionArray);
  return unionArray;
}

// Função auxiliar para determinar se um dia está disponível globalmente com base na configuração dos horários.
function isDayAvailable(date: Date, operatingHours: OperatingHours, exceptions: any[]): boolean {
  const dummyBarber: BarberWithSchedule = { id: "dummy", name: "dummy", horarios: operatingHours };
  const effective = getEffectiveDayConfig(dummyBarber, date, operatingHours, exceptions);
  console.log(`Verificação se dia ${getLocalDateString(date)} está disponível (dummy):`, effective !== null);
  return effective !== null;
}

// ----------------------
// Componente de Agendamento
// ----------------------

const Agendamento: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { operatingHours, exceptions } = useOperatingHours();

  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<{ name: string; duration: number; value: number } | null>(null);
  const [serviceOptions, setServiceOptions] = useState<{ name: string; duration: number; value: number }[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | "Qualquer" | "">("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [barberList, setBarberList] = useState<BarberWithSchedule[]>([]);
  const [computedSlots, setComputedSlots] = useState<{ manha: string[]; tarde: string[]; noite: string[] }>({
    manha: [],
    tarde: [],
    noite: [],
  });

  // Estados para configurações individuais do barbeiro (quando aplicável)
  const [indivOperatingHours, setIndivOperatingHours] = useState<OperatingHours | null>(null);
  const [indivExceptions, setIndivExceptions] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user && !loading) {
        try {
          const userDocRef = doc(db, "usuarios", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserName(data.name || "");
          }
        } catch (error) {
          console.error("Erro ao buscar dados do usuário:", error);
        }
      }
    };
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
          } as BarberWithSchedule;
        });
        setBarberList(list);
      } catch (error) {
        console.error("Erro ao buscar barbeiros:", error);
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
          return { name: data.name, duration: Number(data.duration), value: Number(data.value) };
        });
        setServiceOptions(services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
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
          console.error("Erro ao carregar configuração individual do barbeiro:", error);
          setIndivOperatingHours(null);
          setIndivExceptions([]);
        });
    } else {
      setIndivOperatingHours(null);
      setIndivExceptions([]);
    }
  }, [selectedBarber]);

  // Para configurações, usamos diretamente o objeto "horarios" (já que não há "diasSemana")
  const currentOperatingHours = selectedBarber !== "Qualquer" && indivOperatingHours ? indivOperatingHours : operatingHours;
  const currentExceptions = selectedBarber !== "Qualquer" && indivExceptions.length > 0 ? indivExceptions : exceptions;
  const effectiveOperatingHours: OperatingHours = currentOperatingHours || defaultOperatingHours;
  const effectiveExceptions: any[] = currentExceptions || [];

  useEffect(() => {
    if (!selectedDate) {
      setBookedSlots([]);
      return;
    }
    const normalizedDateStr = getLocalDateString(selectedDate);
    if (selectedBarber === "Qualquer") {
      const unionSlots = getUnionSlotsForDate(selectedDate, barberList, operatingHours, exceptions);
      if (unionSlots.length === 0) {
        setFeedback("O agendamento não está disponível para a data selecionada.");
        setBookedSlots([]);
        setComputedSlots({ manha: [], tarde: [], noite: [] });
      } else {
        setFeedback("");
        setComputedSlots(groupSlots(unionSlots));
      }
    } else {
      // Para um barbeiro específico, calcula a configuração individual
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
        setBookedSlots([]);
        return;
      } else {
        setFeedback("");
        const slots = generateSlots(effectiveConfig.open!, effectiveConfig.close!, 30);
        setComputedSlots(groupSlots(slots));
      }
    }
    let q;
    if (selectedBarber === "Qualquer") {
      if (barberList.length === 0) {
        setBookedSlots([]);
        return;
      }
      const barberIds = barberList.map((b) => b.id);
      q = query(
        collection(db, "agendamentos"),
        where("dateStr", "==", normalizedDateStr),
        where("barberId", "in", barberIds)
      );
    } else {
      q = query(
        collection(db, "agendamentos"),
        where("dateStr", "==", normalizedDateStr),
        where("barberId", "==", (selectedBarber as Barber).id)
      );
    }
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (selectedBarber === "Qualquer") {
        const slotCount: { [key: string]: number } = {};
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          let slots: string[] = [];
          if (data.timeSlots) {
            slots = data.timeSlots;
          } else if (data.timeSlot) {
            slots = [data.timeSlot];
          }
          slots.forEach((slot) => {
            slotCount[slot] = (slotCount[slot] || 0) + 1;
          });
        });
        const fullyBookedSlots = Object.keys(slotCount).filter(
          (slot) => slotCount[slot] >= barberList.length
        );
        setBookedSlots(fullyBookedSlots);
      } else {
        const booked: string[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.timeSlots) {
            booked.push(...data.timeSlots);
          } else if (data.timeSlot) {
            booked.push(data.timeSlot);
          }
        });
        setBookedSlots(Array.from(new Set(booked)));
      }
    });
    return () => unsubscribe();
  }, [selectedDate, selectedBarber, barberList, effectiveOperatingHours, effectiveExceptions, operatingHours, exceptions]);

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
      console.error("Erro ao salvar agendamento:", error);
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
    if (selectedBarber !== "Qualquer") {
      if (!isDayAvailable(selectedDate, effectiveOperatingHours, effectiveExceptions)) {
        setFeedback("O agendamento não está disponível para a data selecionada.");
        return;
      }
    } else {
      const unionSlots = getUnionSlotsForDate(selectedDate, barberList, operatingHours, exceptions);
      if (unionSlots.length === 0) {
        setFeedback("O agendamento não está disponível para a data selecionada.");
        return;
      }
    }
    
    let openTime: string | undefined;
    let closeTime: string | undefined;
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
        }
      } else {
        let availableBarber: BarberWithSchedule | null = null;
        for (const barber of barberList) {
          const effectiveSchedule = barber.horarios ? barber.horarios : (operatingHours || defaultOperatingHours);
          const config = effectiveSchedule[getDayName(selectedDate)];
          if (!config || !config.active || !config.open || !config.close) continue;
          const slots = generateSlots(config.open, config.close, 30);
          if (!slots.includes(selectedTimeSlot)) continue;
          availableBarber = barber;
          openTime = config.open;
          closeTime = config.close;
          break;
        }
        if (!availableBarber) {
          setFeedback("Horário não disponível. Selecione outro horário.");
          return;
        }
      }
    }
    if (!openTime || !closeTime) {
      setFeedback("Horários não configurados para o dia selecionado.");
      return;
    }
    const dynamicSlots = generateSlots(openTime, closeTime, 30);
    const slotsNeeded = Math.ceil(selectedService.duration / 30);
    const index = dynamicSlots.indexOf(selectedTimeSlot);
    if (index === -1 || index + slotsNeeded > dynamicSlots.length) {
      setFeedback("O horário selecionado não permite o serviço completo.");
      return;
    }
    const requiredSlots = dynamicSlots.slice(index, index + slotsNeeded);
    const conflict = requiredSlots.some((slot) => bookedSlots.includes(slot));
    if (conflict) {
      setFeedback("Horário não disponível. Selecione outro horário.");
      return;
    }
    if (selectedBarber !== "Qualquer") {
      if (bookedSlots.some((slot) => requiredSlots.includes(slot))) {
        setFeedback("Horário não disponível. Selecione outro horário.");
        return;
      }
      await saveAppointment(selectedBarber as Barber, requiredSlots);
    } else {
      setFeedback("Horário não disponível. Selecione outro horário.");
      return;
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
            Agendamento para: <strong>{userName || user?.email || "Usuário desconhecido"}</strong>
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
                          {slots
                            .filter((slot) => !bookedSlots.includes(slot))
                            .map((slot) => (
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
                <button type="button" onClick={handleBack} className="bg-gray-500 text-white px-4 py-2 rounded">
                  Voltar
                </button>
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                  Confirmar Agendamento
                </button>
              </div>
              {feedback && <p className="mt-4 text-center text-red-500">{feedback}</p>}
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Agendamento;