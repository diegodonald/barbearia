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
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Defina o número total de barbeiros disponíveis (atualize essa constante conforme necessário)
const TOTAL_BARBERS = 3;

// Função auxiliar que retorna a data no formato "YYYY-MM-DD" usando o horário local
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

const Agendamento: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Controle do fluxo de etapas
  const [step, setStep] = useState<number>(1);

  // Etapa 1: Seleção do Serviço
  const [selectedService, setSelectedService] = useState<string>("");

  // Etapa 2: Seleção do Barbeiro
  const [selectedBarber, setSelectedBarber] = useState<string>("");

  // Etapa 3: Seleção de Data e Hora
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");

  // Estado para armazenar os horários já ocupados (usado para filtrar a UI)
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Mensagem de feedback para o usuário
  const [feedback, setFeedback] = useState<string>("");

  // Dados extras do usuário (ex.: nome)
  const [userName, setUserName] = useState<string>("");

  // Horários disponíveis (fixos, para demonstração)
  const availableSlots = {
    morning: ["10:00", "10:30", "11:00"],
    afternoon: ["12:30", "13:00", "13:30", "14:00"],
    evening: ["17:00", "17:30", "18:00"],
  };

  // Se o usuário não estiver autenticado, redireciona para a página de login
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Busca dados extras do usuário na coleção "usuarios" para obter, por exemplo, o nome
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

  // onSnapshot para atualizar em tempo real os horários ocupados, baseado na data e no barbeiro selecionados
  useEffect(() => {
    if (selectedDate) {
      // Normaliza a data para o formato "YYYY-MM-DD" (usando horário local)
      const normalizedDateStr = getLocalDateString(selectedDate);
      console.log("Data selecionada (local):", normalizedDateStr);

      let q;
      if (selectedBarber === "Qualquer") {
        // Consulta para todos os barbeiros – usamos o campo "barber"
        q = query(
          collection(db, "agendamentos"),
          where("dateStr", "==", normalizedDateStr),
          where("barber", "in", ["Barbeiro 1", "Barbeiro 2", "Barbeiro 3"])
        );
      } else {
        // Consulta para um barbeiro específico
        q = query(
          collection(db, "agendamentos"),
          where("dateStr", "==", normalizedDateStr),
          where("barber", "==", selectedBarber)
        );
      }

      // Listener em tempo real (onSnapshot)
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        if (selectedBarber === "Qualquer") {
          const slotCount: { [key: string]: number } = {};
          querySnapshot.forEach((docSnap) => {
            const timeSlot = docSnap.data().timeSlot;
            if (timeSlot) {
              slotCount[timeSlot] = (slotCount[timeSlot] || 0) + 1;
            }
          });
          // Se um horário tiver agendamentos maiores ou iguais a TOTAL_BARBERS, ele está bloqueado
          const fullyBookedSlots = Object.keys(slotCount).filter(
            (slot) => slotCount[slot] >= TOTAL_BARBERS
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
  }, [selectedDate, selectedBarber]);

  // Handlers para navegação entre as etapas
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
  // Agora, se for fornecido um barbeiro específico (quando em "Qualquer"), usa-o
  const saveAppointment = async (assignedBarber?: string) => {
    if (!selectedDate) return;
    // Usa o mesmo formato local para a data
    const normalizedDateStr = getLocalDateString(selectedDate);
    try {
      // Se atribuímos um barbeiro no modo "Qualquer", usa-o; senão, utiliza o selecionado
      const barberToSave = assignedBarber ? assignedBarber : selectedBarber;
      const docRef = await addDoc(collection(db, "agendamentos"), {
        uid: user?.uid,
        email: user?.email,
        name: userName,
        service: selectedService,
        barber: barberToSave,
        dateStr: normalizedDateStr, // Salva a data como string (YYYY-MM-DD)
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

  // Handler para confirmar o agendamento
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
      // Modo para um barbeiro específico
      if (bookedSlots.includes(selectedTimeSlot)) {
        setFeedback("Esse horário não está disponível. Por favor, escolha outro.");
        return;
      }
      await saveAppointment();
    } else {
      // Modo "Qualquer Barbeiro": busca o primeiro barbeiro disponível para aquele horário
      const barberList = ["Barbeiro 1", "Barbeiro 2", "Barbeiro 3"];
      let availableBarber = "";
      for (const barber of barberList) {
        const q = query(
          collection(db, "agendamentos"),
          where("dateStr", "==", normalizedDateStr),
          where("barber", "==", barber),
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
      // Se encontrou um barbeiro disponível, salva o agendamento com esse barbeiro
      await saveAppointment(availableBarber);
    }
  };

  if (loading || !user) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Agendamento</h1>
      <div className="max-w-3xl mx-auto bg-white p-4 rounded shadow mb-6">
        <p className="text-lg text-center">
          Agendamento para: <strong>{userName || user.email}</strong>
        </p>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        {step === 1 && (
          <>
            <h2 className="text-xl mb-4">Selecione o Serviço</h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedService("Corte")}
                className={`w-full p-2 border rounded ${
                  selectedService === "Corte" ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                Corte
              </button>
              <button
                type="button"
                onClick={() => setSelectedService("Barba")}
                className={`w-full p-2 border rounded ${
                  selectedService === "Barba" ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                Barba
              </button>
              <button
                type="button"
                onClick={() => setSelectedService("Corte e Barba")}
                className={`w-full p-2 border rounded ${
                  selectedService === "Corte e Barba" ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                Corte e Barba
              </button>
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
              <button
                type="button"
                onClick={() => setSelectedBarber("Barbeiro 1")}
                className={`w-full p-2 border rounded ${
                  selectedBarber === "Barbeiro 1" ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                Barbeiro 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedBarber("Barbeiro 2")}
                className={`w-full p-2 border rounded ${
                  selectedBarber === "Barbeiro 2" ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                Barbeiro 2
              </button>
              <button
                type="button"
                onClick={() => setSelectedBarber("Barbeiro 3")}
                className={`w-full p-2 border rounded ${
                  selectedBarber === "Barbeiro 3" ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                Barbeiro 3
              </button>
              <button
                type="button"
                onClick={() => setSelectedBarber("Qualquer")}
                className={`w-full p-2 border rounded ${
                  selectedBarber === "Qualquer" ? "bg-blue-500 text-white" : "bg-white"
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
                  {/* Seção Manhã */}
                  <div>
                    <h4 className="font-bold">Manhã</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {availableSlots.morning
                        .filter((slot) => !bookedSlots.includes(slot))
                        .map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`px-3 py-1 border rounded ${
                              selectedTimeSlot === slot
                                ? "bg-blue-500 text-white"
                                : "bg-white"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                    </div>
                  </div>
                  {/* Seção Tarde */}
                  <div>
                    <h4 className="font-bold">Tarde</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {availableSlots.afternoon
                        .filter((slot) => !bookedSlots.includes(slot))
                        .map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`px-3 py-1 border rounded ${
                              selectedTimeSlot === slot
                                ? "bg-blue-500 text-white"
                                : "bg-white"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                    </div>
                  </div>
                  {/* Seção Noite */}
                  <div>
                    <h4 className="font-bold">Noite</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {availableSlots.evening
                        .filter((slot) => !bookedSlots.includes(slot))
                        .map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`px-3 py-1 border rounded ${
                              selectedTimeSlot === slot
                                ? "bg-blue-500 text-white"
                                : "bg-white"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                    </div>
                  </div>
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
    </div>
  );
};

export default Agendamento;