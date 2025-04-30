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

// Função auxiliar que retorna a data no formato "YYYY-MM-DD" usando o horário local
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Interfaces para tipagem do controle de horários
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

interface OperatingHours {
  diasSemana: {
    domingo: DayConfig;
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
  };
}

// Função auxiliar para obter o nome do dia da semana, em português
function getDayName(date: Date): keyof OperatingHours["diasSemana"] {
  const days = [
    "domingo",
    "segunda",
    "terça",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
  ];
  return days[date.getDay()] as keyof OperatingHours["diasSemana"];
}

// Função que gera dinamicamente os slots de horário
function generateSlots(start: string, end: string, interval: number): string[] {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const slots: string[] = [];
  for (let time = startTotal; time <= endTotal; time += interval) {
    const hour = Math.floor(time / 60);
    const minute = time % 60;
    const slot = `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
    slots.push(slot);
  }
  return slots;
}

// Função para agrupar os slots em períodos do dia: "manhã", "tarde" e "noite"
// Internamente usamos as chaves "manha", "tarde" e "noite"
function groupSlots(
  slots: string[]
): { manha: string[]; tarde: string[]; noite: string[] } {
  const manha = slots.filter((slot) => slot < "12:00");
  const tarde = slots.filter((slot) => slot >= "12:00" && slot < "17:00");
  const noite = slots.filter((slot) => slot >= "17:00");
  return { manha, tarde, noite };
}

// Tipo que representa um serviço (conforme a coleção "servicos")
interface Service {
  name: string;
  duration: number; // duração em minutos
  value: number;
}

// Tipo para representar os barbeiros
interface Barber {
  id: string;
  name: string;
}

// Função auxiliar que verifica se o dia selecionado está disponível para agendamento.
// Agora, se houver exceção com status "blocked", retorna false; se houver "available", retorna true.
function isDayAvailable(
  selectedDate: Date,
  operatingHours: OperatingHours,
  exceptions: any[]
): boolean {
  const normalized = getLocalDateString(selectedDate);
  const dayName = getDayName(selectedDate);
  const dayConfig: DayConfig = operatingHours.diasSemana[dayName];
  const exception = exceptions.find((ex) => ex.date === normalized);

  if (exception) {
    if (exception.status === "blocked") {
      console.log(`Dia ${normalized} bloqueado por exceção.`);
      return false;
    } else if (exception.status === "available") {
      console.log(`Dia ${normalized} liberado por exceção.`);
      return true;
    }
  }

  console.log(`Dia ${normalized} sem exceção. active=${dayConfig.active}`);
  return dayConfig.active;
}

const Agendamento: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Hook para configuração global de horários e exceções
  const { operatingHours, exceptions } = useOperatingHours();

  // Controle do fluxo de etapas
  const [step, setStep] = useState<number>(1);

  // Etapa 1: Seleção do Serviço
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceOptions, setServiceOptions] = useState<Service[]>([]);

  // Etapa 2: Seleção do Barbeiro – objeto do tipo Barber ou "Qualquer"
  const [selectedBarber, setSelectedBarber] = useState<Barber | "Qualquer" | "">("");

  // Etapa 3: Seleção de Data e Hora
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");

  // Estado para armazenar os horários já ocupados (para a UI)
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Mensagem de feedback
  const [feedback, setFeedback] = useState<string>("");

  // Controle do popup de confirmação
  const [showPopup, setShowPopup] = useState<boolean>(false);

  // Dados extras do usuário (ex.: nome)
  const [userName, setUserName] = useState<string>("");

  // Lista dinâmica de barbeiros
  const [barberList, setBarberList] = useState<Barber[]>([]);

  // Redireciona para login se não estiver autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Busca dados do usuário (nome)
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

  // Busca a lista de barbeiros (role "barber")
  useEffect(() => {
    async function fetchBarbers() {
      try {
        const q = query(
          collection(db, "usuarios"),
          where("role", "==", "barber")
        );
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name as string,
        }));
        setBarberList(list);
        console.log("Barbeiros encontrados:", list);
      } catch (error) {
        console.error("Erro ao buscar barbeiros:", error);
      }
    }
    fetchBarbers();
  }, []);

  // Busca as opções de serviços da coleção "servicos"
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
          } as Service;
        });
        setServiceOptions(services);
        console.log("Serviços encontrados:", services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
      }
    }
    fetchServiceOptions();
  }, []);

  // Atualiza em tempo real os horários ocupados (agendamentos já salvos)
  useEffect(() => {
    if (selectedDate) {
      const normalizedDateStr = getLocalDateString(selectedDate);
      console.log("Data selecionada (local):", normalizedDateStr);

      // Verifica se o dia está disponível para agendamento (prioriza exceções)
      if (operatingHours) {
        if (!isDayAvailable(selectedDate, operatingHours, exceptions)) {
          setFeedback("O agendamento não está disponível para a data selecionada.");
          setBookedSlots([]);
          return;
        } else {
          // Se o dia estiver disponível, limpa eventuais mensagens anteriores
          setFeedback("");
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
          console.log("Booked slots (Qualquer):", fullyBookedSlots);
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
          console.log("Booked slots (Barbeiro específico):", booked);
        }
      });
      return () => unsubscribe();
    } else {
      setBookedSlots([]);
    }
  }, [selectedDate, selectedBarber, barberList, operatingHours, exceptions]);

  // Navegação entre as etapas
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

  // Função para salvar o agendamento, armazenando os slots ocupados
  const saveAppointment = async (assignedBarber: Barber, slots: string[]) => {
    if (!selectedDate) return;
    const normalizedDateStr = getLocalDateString(selectedDate);
    try {
      const docRef = await addDoc(collection(db, "agendamentos"), {
        uid: user?.uid,
        email: user?.email,
        name: userName,
        service: selectedService?.name,
        duration: selectedService?.duration,
        barber: assignedBarber.name,
        barberId: assignedBarber.id,
        dateStr: normalizedDateStr,
        timeSlots: slots,
        createdAt: new Date(),
      });
      console.log("Agendamento salvo com ID:", docRef.id);
      setFeedback("Agendamento salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      setFeedback("Erro ao salvar agendamento. Tente novamente.");
    }
  };

  // Handler para confirmar o agendamento (verifica novamente a disponibilidade do dia)
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
    if (operatingHours && !isDayAvailable(selectedDate, operatingHours, exceptions)) {
      setFeedback("O agendamento não está disponível para a data selecionada.");
      return;
    }

    // Calcula os slots necessários com base na duração do serviço
    const slotsNeeded = Math.ceil(selectedService.duration / 30);
    const index = dynamicSlots.indexOf(selectedTimeSlot);
    if (index === -1 || index + slotsNeeded > dynamicSlots.length) {
      setFeedback("O horário selecionado não permite o serviço completo.");
      return;
    }
    const requiredSlots = dynamicSlots.slice(index, index + slotsNeeded);
    const conflict = requiredSlots.some((slot) =>
      bookedSlots.includes(slot)
    );
    if (conflict) {
      setFeedback("Algum dos horários necessários está indisponível.");
      return;
    }

    if (selectedBarber !== "Qualquer") {
      if (bookedSlots.some((slot) => requiredSlots.includes(slot))) {
        setFeedback("Esse horário não está disponível. Por favor, escolha outro.");
        return;
      }
      await saveAppointment(selectedBarber as Barber, requiredSlots);
    } else {
      if (barberList.length === 0) {
        setFeedback("Nenhum barbeiro disponível.");
        return;
      }
      let availableBarber: Barber | null = null;
      for (const barber of barberList) {
        const q = query(
          collection(db, "agendamentos"),
          where("dateStr", "==", getLocalDateString(selectedDate)),
          where("barberId", "==", barber.id)
        );
        const snapshot = await getDocs(q);
        let bookedForBarber: string[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.timeSlots) {
            bookedForBarber.push(...data.timeSlots);
          } else if (data.timeSlot) {
            bookedForBarber.push(data.timeSlot);
          }
        });
        const conflictForBarber = requiredSlots.some((slot) =>
          bookedForBarber.includes(slot)
        );
        if (!conflictForBarber) {
          availableBarber = barber;
          break;
        }
      }
      if (!availableBarber) {
        setFeedback("Esse horário não está disponível. Por favor, escolha outro.");
        return;
      }
      await saveAppointment(availableBarber, requiredSlots);
    }

    setShowPopup(true);
    setTimeout(() => {
      router.push("/");
    }, 2000);
  };

  // Variáveis para geração dinâmica dos slots
  let dynamicSlots: string[] = [];
  let slotsToDisplay: { manha: string[]; tarde: string[]; noite: string[] } = {
    manha: [],
    tarde: [],
    noite: [],
  };
  if (selectedDate && operatingHours) {
    const dayName = getDayName(selectedDate);
    const dayConfig: DayConfig = operatingHours.diasSemana[dayName];
    if (dayConfig.active && dayConfig.open && dayConfig.close) {
      dynamicSlots = generateSlots(dayConfig.open, dayConfig.close, 30);
      slotsToDisplay = groupSlots(dynamicSlots);
    }
  }

  if (loading || !user) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {/* Popup de Confirmação */}
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
            Agendamento para: <strong>{userName || user.email}</strong>
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
                    const serv = serviceOptions.find(
                      (s) => s.name === serviceName
                    );
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
                <button
                  onClick={handleNext}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
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
                        typeof selectedBarber === "object" &&
                        selectedBarber.id === barber.id
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
                    selectedBarber === "Qualquer"
                      ? "bg-blue-500 text-white"
                      : "bg-white text-black"
                  }`}
                >
                  Qualquer Barbeiro
                </button>
              </div>
              <div className="flex justify-between mt-6">
                <button
                  onClick={handleBack}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Voltar
                </button>
                <button
                  onClick={handleNext}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
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
                  }}
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  className="border px-3 py-2 rounded w-full"
                  placeholderText="Selecione uma data"
                  required
                />
              </div>
              {/* Só exibe os slots se o dia estiver disponível */}
              {selectedDate &&
                operatingHours &&
                isDayAvailable(selectedDate, operatingHours, exceptions) && (
                  <>
                    <h3 className="text-lg mt-4">Horários Disponíveis</h3>
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {Object.entries(slotsToDisplay).map(([periodKey, slots]) => (
                        <div key={periodKey}>
                          <h4 className="font-bold capitalize">
                            {periodKey === "manha"
                              ? "manhã"
                              : periodKey === "tarde"
                              ? "tarde"
                              : "noite"}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {slots
                              .filter((slot) => !bookedSlots.includes(slot))
                              .map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setSelectedTimeSlot(slot)}
                                  className={`px-3 py-1 border rounded ${
                                    selectedTimeSlot === slot
                                      ? "bg-blue-500 text-white"
                                      : "bg-white text-black"
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
              {/* Se o dia não estiver disponível, exibe somente a mensagem de feedback */}
              {selectedDate &&
                operatingHours &&
                !isDayAvailable(selectedDate, operatingHours, exceptions) && (
                  <div className="text-red-500 text-center mt-4">
                    {feedback}
                  </div>
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
            </form>
          )}

          {feedback && !(
            selectedDate &&
            operatingHours &&
            !isDayAvailable(selectedDate, operatingHours, exceptions)
          ) && (
            <p className="mt-4 text-center">{feedback}</p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Agendamento;