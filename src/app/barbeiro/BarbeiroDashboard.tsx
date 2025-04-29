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
// Removi o Footer e Header, pois o Header já foi corrigido e o Footer está duplicado.
// Se necessário, mantenha o Header, mas certifique-se de que o layout global não adicione outro Footer.
// import Header from "@/components/Header";
// import Footer from "@/components/Footer";

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

// Interface para agendamento
interface Appointment {
  id: string;
  dateStr: string;
  timeSlot: string;
  service: string;
  barber: string;
  barberId: string;
  name: string; // Nome do cliente
  status: string;
}

// Interface para representar barbeiros (para dropdown de referência, se necessário)
interface BarberOption {
  id: string;
  name: string;
}

const BarberDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Estados para listagem e edição de agendamentos existentes
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [filterDate, setFilterDate] = useState<string>("");
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  // Estados para novos agendamentos para clientes
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newService, setNewService] = useState<string>("");
  const [newClientName, setNewClientName] = useState<string>("");
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTimeSlot, setNewTimeSlot] = useState<string>("");
  const [newBookedSlots, setNewBookedSlots] = useState<string[]>([]);
  const [newFeedback, setNewFeedback] = useState<string>("");

  // Estados para opções dinâmicas
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);

  // Dados do barbeiro logado
  const [barberInfo, setBarberInfo] = useState<BarberOption | null>(null);

  // Horários disponíveis (fixos, para demonstração)
  const availableSlots = {
    morning: ["10:00", "10:30", "11:00"],
    afternoon: ["12:30", "13:00", "13:30", "14:00"],
    evening: ["17:00", "17:30", "18:00"],
  };

  // Verificação de autenticação e role
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user) {
      setBarberInfo({ id: user.uid, name: (user as any).name || "" });
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
        const appsData: Appointment[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          dateStr: docSnap.data().dateStr,
          timeSlot: docSnap.data().timeSlot,
          service: docSnap.data().service,
          barber: docSnap.data().barber,
          barberId: docSnap.data().barberId,
          name: docSnap.data().name,
          status: docSnap.data().status ? docSnap.data().status : "confirmado",
        }));
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
        const services = snapshot.docs.map((doc) => doc.data().name) as string[];
        setServiceOptions(services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
      }
    }
    fetchServiceOptions();
  }, []);

  // Busca das opções de barbeiros para referência (se necessário)
  useEffect(() => {
    async function fetchBarberOptions() {
      try {
        const q = query(collection(db, "usuarios"), where("role", "==", "barber"));
        const snapshot = await getDocs(q);
        const barbers = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        })) as BarberOption[];
        setBarberOptions(barbers);
      } catch (error) {
        console.error("Erro ao buscar barbeiros:", error);
      }
    }
    fetchBarberOptions();
  }, []);

  // Filtro dos agendamentos existentes por data
  const filteredAppointments = appointments.filter((appt) =>
    filterDate ? appt.dateStr === filterDate : true
  );

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
  };

  const handleCancelEdit = () => {
    setEditingAppointment(null);
  };

  const handleSaveEdit = async () => {
    if (!editingAppointment) return;
    try {
      await updateDoc(doc(db, "agendamentos", editingAppointment.id), {
        dateStr: editingAppointment.dateStr,
        timeSlot: editingAppointment.timeSlot,
        service: editingAppointment.service,
        status: editingAppointment.status,
        barber: editingAppointment.barber,
        barberId: editingAppointment.barberId,
      });
      setEditingAppointment(null);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
    }
  };

  const handleCancelAppointment = async (appt: Appointment) => {
    if (!confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      await deleteDoc(doc(db, "agendamentos", appt.id));
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
    }
  };

  // Atualiza os horários ocupados para o novo agendamento (baseado na data selecionada)
  useEffect(() => {
    if (newDate && barberInfo) {
      const normalizedDateStr = getLocalDateString(newDate);
      const q = query(
        collection(db, "agendamentos"),
        where("dateStr", "==", normalizedDateStr),
        where("barberId", "==", barberInfo.id)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const booked = Array.from(
          new Set(snapshot.docs.map((docSnap) => docSnap.data().timeSlot))
        );
        setNewBookedSlots(booked);
      });
      return () => unsubscribe();
    } else {
      setNewBookedSlots([]);
    }
  }, [newDate, barberInfo]);

  const saveNewAppointment = async () => {
    if (!newDate || !barberInfo) return;
    const normalizedDateStr = getLocalDateString(newDate);
    try {
      await addDoc(collection(db, "agendamentos"), {
        uid: user?.uid,
        email: user?.email,
        name: newClientName,
        service: newService,
        barber: barberInfo.name,
        barberId: barberInfo.id,
        dateStr: normalizedDateStr,
        timeSlot: newTimeSlot,
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
    if (newBookedSlots.includes(newTimeSlot)) {
      setNewFeedback("Esse horário não está disponível. Por favor, escolha outro.");
      return;
    }
    await saveNewAppointment();
  };

  if (loading || !user || loadingAppointments) {
    return <p>Carregando dados...</p>;
  }

  return (
    <div className="p-4">
      {/* O Header deve vir do layout global; se necessário, inclua aqui apenas uma vez */}
      <h1 className="text-2xl font-bold mb-4">Painel do Barbeiro</h1>

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
                  {serviceOptions.map((s, idx) => (
                    <option key={idx} value={s}>
                      {s}
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
                    {(["morning", "afternoon", "evening"] as (keyof typeof availableSlots)[]).map(
                      (period) => (
                        <div key={period}>
                          <h4 className="font-bold capitalize">{period}</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {availableSlots[period]
                              .filter((slot) => !newBookedSlots.includes(slot))
                              .map((slot) => (
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
                      )
                    )}
                  </div>
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
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                  Confirmar Agendamento
                </button>
              </div>
              {newFeedback && <p className="mt-4 text-center">{newFeedback}</p>}
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
              {filteredAppointments.map((app) =>
                editingAppointment && editingAppointment.id === app.id ? (
                  <tr key={app.id}>
                    <td className="px-4 py-2 border">
                      <input
                        type="date"
                        value={editingAppointment.dateStr}
                        onChange={(e) =>
                          setEditingAppointment({
                            ...editingAppointment,
                            dateStr: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded text-black bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-2 border">
                      <input
                        type="time"
                        value={editingAppointment.timeSlot}
                        onChange={(e) =>
                          setEditingAppointment({
                            ...editingAppointment,
                            timeSlot: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded text-black bg-gray-100"
                      />
                    </td>
                    <td className="px-4 py-2 border">
                      <select
                        value={editingAppointment.service}
                        onChange={(e) =>
                          setEditingAppointment({
                            ...editingAppointment,
                            service: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded text-black bg-gray-100"
                      >
                        {serviceOptions.map((s, idx) => (
                          <option key={idx} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 border">{editingAppointment.barber}</td>
                    <td className="px-4 py-2 border">{app.name}</td>
                    <td className="px-4 py-2 border">
                      <select
                        value={editingAppointment.status}
                        onChange={(e) =>
                          setEditingAppointment({
                            ...editingAppointment,
                            status: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded text-black bg-gray-100"
                      >
                        <option value="confirmado">Confirmado</option>
                        <option value="pendente">Pendente</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="finalizado">Finalizado</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 border">
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="bg-green-500 px-3 py-1 rounded hover:bg-green-600 transition"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-500 px-3 py-1 rounded hover:bg-gray-600 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={app.id}>
                    <td className="px-4 py-2 border">{formatDate(app.dateStr)}</td>
                    <td className="px-4 py-2 border">{app.timeSlot}</td>
                    <td className="px-4 py-2 border">{app.service}</td>
                    <td className="px-4 py-2 border">{app.barber}</td>
                    <td className="px-4 py-2 border">{app.name}</td>
                    <td className="px-4 py-2 border">{app.status}</td>
                    <td className="px-4 py-2 border">
                      <div className="flex">
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
                          Cancelar Agendamento
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Footer removido para evitar duplicidade, pois o layout global já o fornece */}
    </div>
  );
};

export default BarberDashboard;