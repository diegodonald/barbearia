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

// Função auxiliar que retorna a data no formato "YYYY-MM-DD" usando o horário local
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Tipo para representar os barbeiros
interface Barber {
  id: string;
  name: string;
}

const Agendamento: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Controle do fluxo de etapas
  const [step, setStep] = useState<number>(1);

  // Etapa 1: Seleção do Serviço (agora através de dropdown, dinâmico)
  const [selectedService, setSelectedService] = useState<string>("");
  // Novo estado para armazenar as opções de serviço cadastradas
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);

  // Etapa 2: Seleção do Barbeiro – pode ser um objeto do tipo Barber, a string "Qualquer" ou ""
  const [selectedBarber, setSelectedBarber] = useState<Barber | "Qualquer" | "">("");
  
  // Etapa 3: Seleção de Data e Hora
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");

  // Estado para armazenar os horários já ocupados (para a UI)
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Mensagem de feedback
  const [feedback, setFeedback] = useState<string>("");

  // Estado para controlar a exibição do popup de confirmação
  const [showPopup, setShowPopup] = useState<boolean>(false);

  // Dados extras do usuário (ex.: nome)
  const [userName, setUserName] = useState<string>("");

  // Lista dinâmica de barbeiros – array de objetos {id, name}
  const [barberList, setBarberList] = useState<Barber[]>([]);

  // Horários disponíveis (fixos, para demonstração)
  const availableSlots = {
    morning: ["10:00", "10:30", "11:00"],
    afternoon: ["12:30", "13:00", "13:30", "14:00"],
    evening: ["17:00", "17:30", "18:00"],
  };

  // Redireciona para login se o usuário não estiver autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Busca dados extras do usuário (ex.: nome)
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

  // Busca dinamicamente a lista de barbeiros (usuários com role "barber")
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

  // Busca as opções de serviços cadastrados (a partir da coleção "servicos")
  useEffect(() => {
    async function fetchServiceOptions() {
      try {
        const q = query(collection(db, "servicos"));
        const snapshot = await getDocs(q);
        const services = snapshot.docs.map((doc) => doc.data().name) as string[];
        setServiceOptions(services);
        console.log("Serviços encontrados:", services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
      }
    }
    fetchServiceOptions();
  }, []);

  // onSnapshot para atualizar em tempo real os horários ocupados, baseado na data e no barbeiro selecionados
  useEffect(() => {
    if (selectedDate) {
      const normalizedDateStr = getLocalDateString(selectedDate);
      console.log("Data selecionada (local):", normalizedDateStr);

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
            const timeSlot = docSnap.data().timeSlot;
            if (timeSlot) {
              slotCount[timeSlot] = (slotCount[timeSlot] || 0) + 1;
            }
          });
          const fullyBookedSlots = Object.keys(slotCount).filter(
            (slot) => slotCount[slot] >= barberList.length
          );
          setBookedSlots(fullyBookedSlots);
          console.log("Booked slots (Qualquer):", fullyBookedSlots);
        } else {
          const booked = Array.from(
            new Set(querySnapshot.docs.map((docSnap) => docSnap.data().timeSlot))
          );
          setBookedSlots(booked);
          console.log("Booked slots (Barbeiro específico):", booked);
        }
      });

      return () => unsubscribe();
    } else {
      setBookedSlots([]);
    }
  }, [selectedDate, selectedBarber, barberList]);

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

  // Função para salvar o agendamento no Firestore
  const saveAppointment = async (assignedBarber?: Barber) => {
    if (!selectedDate) return;
    const normalizedDateStr = getLocalDateString(selectedDate);
    try {
      const barberToSave = assignedBarber ? assignedBarber : (selectedBarber as Barber);
      const docRef = await addDoc(collection(db, "agendamentos"), {
        uid: user?.uid,
        email: user?.email,
        name: userName,
        service: selectedService,
        barber: barberToSave.name,
        barberId: barberToSave.id,
        dateStr: normalizedDateStr,
        timeSlot: selectedTimeSlot,
        createdAt: new Date(),
      });
      console.log("Agendamento salvo com ID:", docRef.id);
      setFeedback("Agendamento salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      setFeedback("Erro ao salvar agendamento. Tente novamente.");
    }
  };

  // Handler para confirmar o agendamento, exibindo o popup e redirecionando após 2 segundos
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
    const normalizedDateStr = getLocalDateString(selectedDate);
    if (selectedBarber !== "Qualquer") {
      if (bookedSlots.includes(selectedTimeSlot)) {
        setFeedback("Esse horário não está disponível. Por favor, escolha outro.");
        return;
      }
      await saveAppointment();
    } else {
      if (barberList.length === 0) {
        setFeedback("Nenhum barbeiro disponível.");
        return;
      }
      let availableBarber: Barber | null = null;
      for (const barber of barberList) {
        const q = query(
          collection(db, "agendamentos"),
          where("dateStr", "==", normalizedDateStr),
          where("barberId", "==", barber.id),
          where("timeSlot", "==", selectedTimeSlot)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          availableBarber = barber;
          break;
        }
      }
      if (!availableBarber) {
        setFeedback("Esse horário não está disponível. Por favor, escolha outro.");
        return;
      }
      await saveAppointment(availableBarber);
    }

    // Exibe o popup de confirmação e redireciona após 2 segundos
    setShowPopup(true);
    setTimeout(() => {
      router.push("/");
    }, 2000);
  };

  if (loading || !user) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {/* Popup de Confirmação sem escurecer o fundo */}
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
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-3 py-2 border rounded bg-white text-black"
                >
                  <option value="">Selecione um serviço</option>
                  {serviceOptions.map((s, idx) => (
                    <option key={idx} value={s}>
                      {s}
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
                    setSelectedTimeSlot(""); // Reseta o horário ao alterar a data
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
                    {(
                      ["morning", "afternoon", "evening"] as (keyof typeof availableSlots)[]
                    ).map((timePeriod) => (
                      <div key={timePeriod}>
                        <h4 className="font-bold capitalize">{timePeriod}</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {availableSlots[timePeriod]
                            .filter((slot: string) => !bookedSlots.includes(slot))
                            .map((slot: string) => (
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
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-500 text-white px-4 py-2 rounded"
                >
                  Voltar
                </button>
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          )}

          {feedback && <p className="mt-4 text-center">{feedback}</p>}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Agendamento;