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

// Retorna a data no formato "YYYY-MM-DD"
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

export interface OperatingHours {
  diasSemana: {
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
    domingo: DayConfig;
  };
}

// Fallback padrão para operatingHours (configuração global padrão)
const defaultOperatingHours: OperatingHours = {
  diasSemana: {
    segunda: { open: "08:00", close: "18:00", active: true },
    terça: { open: "08:00", close: "18:00", active: true },
    quarta: { open: "08:00", close: "18:00", active: true },
    quinta: { open: "08:00", close: "18:00", active: true },
    sexta: { open: "08:00", close: "18:00", active: true },
    sábado: { open: "09:00", close: "14:00", active: true },
    domingo: { active: false },
  },
};

// Retorna o nome do dia da semana (em português)
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

// Gera os slots de horário conforme um intervalo (em minutos)
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

interface Service {
  name: string;
  duration: number;
  value: number;
}

interface Barber {
  id: string;
  name: string;
}

// Verifica se o dia está disponível para agendamento, utilizando exceções se houver.
// Se operatingHours ou operatingHours.diasSemana não estiverem definidos, utiliza fallback.
function isDayAvailable(
  selectedDate: Date,
  operatingHours: OperatingHours,
  exceptions: any[]
): boolean {
  const normalized = getLocalDateString(selectedDate);
  const dayName = getDayName(selectedDate);

  if (!operatingHours || !operatingHours.diasSemana) {
    console.error("operatingHours ou operatingHours.diasSemana não estão definidos.", operatingHours);
    return false;
  }

  const dayConfig: DayConfig =
    operatingHours.diasSemana[dayName] ||
    (() => {
      console.error(`Configuração para o dia '${dayName}' não encontrada. Utilizando fallback.`);
      return { open: "08:00", close: "18:00", active: false };
    })();

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
  const { operatingHours, exceptions } = useOperatingHours();

  // Estados do fluxo de agendamento
  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceOptions, setServiceOptions] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | "Qualquer" | "">("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [showPopup, setShowPopup] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [barberList, setBarberList] = useState<Barber[]>([]);

  // Estados para a configuração individual do barbeiro (se aplicável)
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

  useEffect(() => {
    async function fetchServiceOptions() {
      try {
        const q = query(collection(db, "servicos"));
        const snapshot = await getDocs(q);
        const services = snapshot.docs.map((doc) => {
          const data = doc.data();
          return { name: data.name, duration: Number(data.duration), value: Number(data.value) } as Service;
        });
        setServiceOptions(services);
        console.log("Serviços encontrados:", services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
      }
    }
    fetchServiceOptions();
  }, []);

  // Carrega a configuração individual do barbeiro, se um for selecionado
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

  // Define a configuração corrente: usa a individual se disponível; caso contrário, a global
  const currentOperatingHours =
    selectedBarber !== "Qualquer" && indivOperatingHours ? indivOperatingHours : operatingHours;
  const currentExceptions =
    selectedBarber !== "Qualquer" && indivExceptions.length > 0 ? indivExceptions : exceptions;

  // Aqui, garantimos que se currentOperatingHours estiver vazio ou não tiver "diasSemana", usamos o fallback
  const effectiveOperatingHours: OperatingHours =
    (currentOperatingHours && currentOperatingHours.diasSemana) ? currentOperatingHours : defaultOperatingHours;
  const effectiveExceptions: any[] = currentExceptions || [];

  // Atualiza os slots ocupados, em tempo real, baseado nos agendamentos
  useEffect(() => {
    if (selectedDate) {
      const normalizedDateStr = getLocalDateString(selectedDate);
      console.log("Data selecionada (local):", normalizedDateStr);

      if (!effectiveOperatingHours || !effectiveOperatingHours.diasSemana) {
        console.error("OperatingHours efetivo não definido:", effectiveOperatingHours);
        setFeedback("Configurações de horários não estão disponíveis.");
        setBookedSlots([]);
        return;
      }

      if (!isDayAvailable(selectedDate, effectiveOperatingHours, effectiveExceptions)) {
        setFeedback("O agendamento não está disponível para a data selecionada.");
        setBookedSlots([]);
        return;
      } else {
        setFeedback("");
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
  }, [selectedDate, selectedBarber, barberList, effectiveOperatingHours, effectiveExceptions]);

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
    if (!isDayAvailable(selectedDate, effectiveOperatingHours, effectiveExceptions)) {
      setFeedback("O agendamento não está disponível para a data selecionada.");
      return;
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
      console.log(`Usando horários de exceção: ${openTime} às ${closeTime}`);
    } else {
      const dayName = getDayName(selectedDate);
      const dayConfig: DayConfig | undefined = effectiveOperatingHours.diasSemana?.[dayName];
      if (!dayConfig) {
        setFeedback("Horários não configurados para o dia selecionado.");
        return;
      }
      if (dayConfig.active && dayConfig.open && dayConfig.close) {
        openTime = dayConfig.open;
        closeTime = dayConfig.close;
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
      if (barberList.length === 0) {
        setFeedback("Nenhum barbeiro disponível.");
        return;
      }
      let availableBarber: Barber | null = null;
      for (const barber of barberList) {
        const q = query(
          collection(db, "agendamentos"),
          where("dateStr", "==", normalized),
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

  let dynamicSlots: string[] = [];
  let slotsToDisplay: { manha: string[]; tarde: string[]; noite: string[] } = {
    manha: [],
    tarde: [],
    noite: [],
  };
  if (selectedDate && effectiveOperatingHours) {
    const normalized = getLocalDateString(selectedDate);
    const exception = effectiveExceptions.find(
      (ex) =>
        ex.date === normalized &&
        ex.status === "available" &&
        ex.open &&
        ex.close
    );
    let openTime: string | undefined;
    let closeTime: string | undefined;
    if (exception) {
      openTime = exception.open;
      closeTime = exception.close;
    } else {
      const dayName = getDayName(selectedDate);
      const dayConfig: DayConfig | undefined = effectiveOperatingHours.diasSemana?.[dayName];
      if (dayConfig && dayConfig.active && dayConfig.open && dayConfig.close) {
        openTime = dayConfig.open;
        closeTime = dayConfig.close;
      }
    }
    if (openTime && closeTime) {
      dynamicSlots = generateSlots(openTime, closeTime, 30);
      slotsToDisplay = groupSlots(dynamicSlots);
    }
  }

  if (loading || !user) {
    return <p>Carregando...</p>;
  }

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
              {selectedDate && effectiveOperatingHours && isDayAvailable(selectedDate, effectiveOperatingHours, effectiveExceptions) ? (
                <>
                  <h3 className="text-lg mt-4">Horários Disponíveis</h3>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {Object.entries(slotsToDisplay).map(([periodKey, slots]) => (
                      <div key={periodKey}>
                        <h4 className="font-bold capitalize">
                          {periodKey === "manha" ? "manhã" : periodKey === "tarde" ? "tarde" : "noite"}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {slots.filter((slot) => !bookedSlots.includes(slot)).map((slot) => (
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
              ) : selectedDate && effectiveOperatingHours && !isDayAvailable(selectedDate, effectiveOperatingHours, effectiveExceptions) ? (
                <div className="text-red-500 text-center mt-4">
                  O agendamento não está disponível para a data selecionada.
                </div>
              ) : null}
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