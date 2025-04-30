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

// Interface do agendamento
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

// Interface para as opções de barbeiro (usada no dropdown na edição)
interface BarberOption {
  id: string;
  name: string;
}

const ClientAppointments: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Estados básicos
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [filterDate, setFilterDate] = useState<string>("");

  // Estado para controle da edição inline de um agendamento
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  // Estados para opções dinâmicas
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);

  // Estado para feedback de operação (edição e cancelamento)
  const [feedback, setFeedback] = useState<string>("");

  // Verifica autenticação; se não estiver logado, redireciona
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Verifica que o usuário tem a role de cliente
  useEffect(() => {
    if (!loading && user) {
      // Se você tiver uma role para cliente, pode adicionar uma verificação aqui.
      // Por exemplo: if ((user as ExtendedUser).role !== "client") { router.push("/"); }
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
        const apps: Appointment[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          dateStr: docSnap.data().dateStr,
          timeSlot: docSnap.data().timeSlot,
          service: docSnap.data().service,
          barber: docSnap.data().barber,
          barberId: docSnap.data().barberId,
          name: docSnap.data().name,
          status: docSnap.data().status ? docSnap.data().status : "confirmado",
        }));
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
        const services = snapshot.docs.map((doc) => doc.data().name) as string[];
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

  // Função que, antes de salvar a edição, consulta o banco para verificar se o novo horário está livre.
  // Ela consulta os agendamentos para o mesmo barberId, data e horário e, se encontrar conflito em outro documento, retorna false.
  const checkAvailability = async (appt: Appointment): Promise<boolean> => {
    const q = query(
      collection(db, "agendamentos"),
      where("dateStr", "==", appt.dateStr),
      where("barberId", "==", appt.barberId),
      where("timeSlot", "==", appt.timeSlot)
    );
    const snapshot = await getDocs(q);
    // Se houver algum documento encontrado que tenha um id diferente, há conflito.
    const conflict = snapshot.docs.some((docSnap) => docSnap.id !== appt.id);
    return !conflict;
  };

  // Handler para salvar a edição de um agendamento pelo cliente
  const handleSaveEdit = async () => {
    if (!editingAppointment) return;
    // Verifica disponibilidade antes de salvar a edição
    const available = await checkAvailability(editingAppointment);
    if (!available) {
      setFeedback("O horário selecionado não está disponível. Por favor, escolha outro.");
      return;
    }
    try {
      await updateDoc(doc(db, "agendamentos", editingAppointment.id), {
        dateStr: editingAppointment.dateStr,
        timeSlot: editingAppointment.timeSlot,
        service: editingAppointment.service,
        barber: editingAppointment.barber,
        barberId: editingAppointment.barberId,
        status: editingAppointment.status,
      });
      setEditingAppointment(null);
      setFeedback("Agendamento atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      setFeedback("Erro ao atualizar agendamento. Tente novamente.");
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

  // Handler para iniciar a edição (modo inline)
  const handleStartEditing = (appt: Appointment) => {
    // Cria uma cópia do agendamento para edição
    setEditingAppointment({ ...appt });
    setFeedback("");
  };

  // Handler para cancelar a edição
  const handleCancelEdit = () => {
    setEditingAppointment(null);
    setFeedback("");
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
                {filteredAppointments.map((app) =>
                  editingAppointment && editingAppointment.id === app.id ? (
                    // Linha em modo de edição
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
                          className="w-full px-2 py-1 rounded text-black bg-gray-100"
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
                          className="w-full px-2 py-1 rounded text-black bg-gray-100"
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
                          className="w-full px-2 py-1 rounded text-black bg-gray-100"
                        >
                          {serviceOptions.map((s, idx) => (
                            <option key={idx} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 border">
                        {/* Mostra o barbeiro atual. Para permitir alteração, você pode usar um dropdown semelhante */}
                        <select
                          value={editingAppointment.barberId}
                          onChange={async (e) => {
                            const selectedId = e.target.value;
                            const selectedBarberOption = barberOptions.find(
                              (b) => b.id === selectedId
                            );
                            if (selectedBarberOption) {
                              setEditingAppointment({
                                ...editingAppointment,
                                barberId: selectedBarberOption.id,
                                barber: selectedBarberOption.name,
                              });
                            }
                          }}
                          className="w-full px-2 py-1 rounded text-black bg-gray-100"
                        >
                          {barberOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 border">
                        <select
                          value={editingAppointment.status}
                          onChange={(e) =>
                            setEditingAppointment({
                              ...editingAppointment,
                              status: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 rounded text-black bg-gray-100"
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
                    // Linha de visualização normal
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
                  )
                )}
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