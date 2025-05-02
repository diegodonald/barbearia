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
// Helpers and Basic Functions
// ----------------------

// Format a Date as "YYYY-MM-DD"
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Return the day name (in Portuguese) for the date
function getDayName(date: Date): keyof OperatingHours {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return days[date.getDay()] as keyof OperatingHours;
}

// Generate time slots between start and end times with a given interval (in minutes)
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

// Group slots into periods: morning, afternoon, and evening
function groupSlots(slots: string[]): { manha: string[]; tarde: string[]; noite: string[] } {
  const manha = slots.filter((slot) => slot < "12:00");
  const tarde = slots.filter((slot) => slot >= "12:00" && slot < "17:00");
  const noite = slots.filter((slot) => slot >= "17:00");
  return { manha, tarde, noite };
}

// ----------------------
// Interfaces and Constants
// ----------------------

// Interface for a day
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

// OperatingHours now has days directly, without "diasSemana"
export interface OperatingHours {
  domingo: DayConfig;
  segunda: DayConfig;
  terça: DayConfig;
  quarta: DayConfig;
  quinta: DayConfig;
  sexta: DayConfig;
  sábado: DayConfig;
}

// Global default configuration (using the new structure)
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
  // In Firebase, "horarios" contains days directly. If absent, it will be null.
  horarios?: OperatingHours | null;
}

// ----------------------
// Functions to Calculate Effective Availability
// ----------------------

// Returns the effective configuration for a barber on a given date,
// taking into account the barber's individual settings and global exceptions.
// Logs are added for debugging.
function getEffectiveDayConfig(
  barber: BarberWithSchedule,
  date: Date,
  globalOperatingHours: OperatingHours,
  globalExceptions: any[]
): DayConfig | null {
  console.log(`Calculating config for barber: ${barber.name}`, barber);
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);
  let config: DayConfig | undefined;

  if (barber.horarios && barber.horarios[dayName] !== undefined) {
    config = barber.horarios[dayName];
    console.log(`Barber ${barber.name}: Found individual config for ${dayName} (${normalizedDate}):`, config);
  } else {
    console.log(`Barber ${barber.name}: No individual config for ${dayName} (${normalizedDate}). Using global.`);
    config = globalOperatingHours[dayName];
    console.log(`Barber ${barber.name}: Global config for ${dayName} (${normalizedDate}):`, config);
  }

  const exception = globalExceptions.find((ex: any) => ex.date === normalizedDate);
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

  if (!config || !config.active || !config.open || !config.close) {
    console.log(`Invalid config for ${barber.name} on ${dayName}:`, config);
    return null;
  }

  console.log(`Effective config for ${barber.name} on ${dayName}:`, config);
  return config;
}

// Generates the union of available slots from all barbers available on the date.
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
      console.log(`Slots for ${barber.name} on ${getDayName(date)} (${getLocalDateString(date)}):`, slots);
      slots.forEach((slot) => unionSet.add(slot));
    }
  });
  const unionArray = Array.from(unionSet).sort();
  console.log(`UnionSlots for ${getLocalDateString(date)}:`, unionArray);
  return unionArray;
}

// Helper to determine if a day is available globally using a dummy barber.
function isDayAvailable(date: Date, operatingHours: OperatingHours, exceptions: any[]): boolean {
  const dummyBarber: BarberWithSchedule = { id: "dummy", name: "dummy", horarios: operatingHours };
  const effective = getEffectiveDayConfig(dummyBarber, date, operatingHours, exceptions);
  console.log(`Check if ${getLocalDateString(date)} is available (dummy):`, effective !== null);
  return effective !== null;
}

// ----------------------
// Agendamento Component
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

  // States for individual barber configuration (if applicable)
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
          console.error("Error fetching user data:", error);
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
          return { name: data.name, duration: Number(data.duration), value: Number(data.value) };
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

  // For configurations, we use the "horarios" object directly (new structure)
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
      // Filter available barbers for the selected date
      const availableBarbers = barberList.filter((b) =>
        getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions)
      );
      if (availableBarbers.length === 0) {
        setFeedback("O agendamento não está disponível para a data selecionada.");
        setBookedSlots([]);
        setComputedSlots({ manha: [], tarde: [], noite: [] });
      } else {
        const unionSlots = getUnionSlotsForDate(selectedDate, availableBarbers, operatingHours, exceptions);
        if (unionSlots.length === 0) {
          setFeedback("O agendamento não está disponível para a data selecionada.");
          setBookedSlots([]);
          setComputedSlots({ manha: [], tarde: [], noite: [] });
        } else {
          setFeedback("");
          setComputedSlots(groupSlots(unionSlots));
        }
      }
    } else {
      // For a specific barber, calculate its effective config
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
      // Use only available barbers' IDs for the query
      const availableBarbers = barberList.filter((b) =>
        getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions)
      );
      if (availableBarbers.length === 0) {
        setBookedSlots([]);
        return;
      }
      const availableBarberIds = availableBarbers.map((b) => b.id);
      q = query(
        collection(db, "agendamentos"),
        where("dateStr", "==", normalizedDateStr),
        where("barberId", "in", availableBarberIds)
      );
      // When counting bookings, use availableBarbers.length as threshold
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
          (slot) => slotCount[slot] >= availableBarbers.length
        );
        setBookedSlots(fullyBookedSlots);
      });
      return () => unsubscribe();
    } else {
      q = query(
        collection(db, "agendamentos"),
        where("dateStr", "==", normalizedDateStr),
        where("barberId", "==", (selectedBarber as Barber).id)
      );
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
      });
      return () => unsubscribe();
    }
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
        // Filter only available barbers for this date
        const availableBarbers = barberList.filter((b) =>
          getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions)
        );
        for (const barber of availableBarbers) {
          const effectiveConfig = getEffectiveDayConfig(
            barber,
            selectedDate,
            operatingHours || defaultOperatingHours,
            exceptions
          );
          if (!effectiveConfig) continue;
          const slots = generateSlots(effectiveConfig.open!, effectiveConfig.close!, 30);
          if (!slots.includes(selectedTimeSlot)) continue;
          availableBarber = barber;
          openTime = effectiveConfig.open;
          closeTime = effectiveConfig.close;
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
      // For "Qualquer Barbeiro", we already filtered availableBarbers in the bookedSlots useEffect.
      // Use that same logic here:
      const availableBarbers = barberList.filter((b) =>
        getEffectiveDayConfig(b, selectedDate, operatingHours || defaultOperatingHours, exceptions)
      );
      let availableBarber: BarberWithSchedule | null = null;
      for (const barber of availableBarbers) {
        const effectiveConfig = getEffectiveDayConfig(
          barber,
          selectedDate,
          operatingHours || defaultOperatingHours,
          exceptions
        );
        if (!effectiveConfig) continue;
        const slots = generateSlots(effectiveConfig.open!, effectiveConfig.close!, 30);
        if (!slots.includes(selectedTimeSlot)) continue;
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