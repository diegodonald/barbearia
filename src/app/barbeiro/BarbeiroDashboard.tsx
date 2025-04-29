"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { ExtendedUser } from "@/hooks/useAuth";

// Define a interface para um agendamento
interface Appointment {
  id: string;
  dateStr: string;
  timeSlot: string;
  service: string;
  barber: string;
  barberId: string;
  name: string; // Nome do cliente
  status: string; // "confirmado", "pendente", "cancelado", "finalizado", etc.
}

// Interface para as opções de serviço e para os barbeiros
// Para os barbeiros, usaremos id e name
interface BarberOption {
  id: string;
  name: string;
}

// Função auxiliar para converter "YYYY-MM-DD" em "DD/MM/YYYY"
const formatDate = (dateStr: string): string => {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const BarberDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  // Filtros por data (o filtro por barbeiro não é necessário, pois o barbeiro vê só os seus)
  const [filterDate, setFilterDate] = useState<string>("");

  // Estado para edição inline: permite que o barbeiro altere Data, Horário, Serviço e Status
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  // Estado para armazenar as opções de serviços (obtidas da coleção "servicos")
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  // Estado para armazenar a lista de barbeiros – embora, neste painel, o usuário seja o barbeiro, 
  // usamos essa lista para preencher o dropdown de serviços (não será editável o campo "barber")
  const [barberOption, setBarberOption] = useState<BarberOption | null>(null);

  // Carrega as opções de serviços
  useEffect(() => {
    const fetchServiceOptions = async () => {
      try {
        const q = query(collection(db, "servicos"));
        const snapshot = await getDocs(q);
        const services = snapshot.docs.map((doc) => doc.data().name) as string[];
        setServiceOptions(services);
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
      }
    };
    fetchServiceOptions();
  }, []);

  // Como este painel é para barbeiros, já sabemos que o usuário logado é barbeiro.
  // Se desejar, podemos definir o barbeiro logado como opção:
  useEffect(() => {
    if (!loading && user) {
      // Usamos o usuário logado para definir o barbeiro
      setBarberOption({ id: user.uid, name: (user as any).name || "" });
    }
  }, [loading, user]);

  // Verifica que apenas usuários com role "barber" podem acessar
  useEffect(() => {
    if (!loading && user) {
      if ((user as ExtendedUser).role !== "barber") {
        router.push("/");
      }
    }
  }, [loading, user, router]);

  // Busca, em tempo real, os agendamentos atribuídos ao barbeiro logado (usando barberId)
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

  // Filtra os agendamentos pelo filtro de data, se definido
  const filteredAppointments = appointments.filter((appt) => {
    return filterDate ? appt.dateStr === filterDate : true;
  });

  // Handlers para filtros "Hoje", "Amanhã" e "Limpar Filtros"
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

  // Função para iniciar a edição de um agendamento: copia os dados para o estado de edição
  const handleStartEditing = (appt: Appointment) => {
    setEditingAppointment({ ...appt });
  };

  // Função para cancelar a edição
  const handleCancelEdit = () => {
    setEditingAppointment(null);
  };

  // Função para salvar as alterações do agendamento (permitindo editar Data, Horário, Serviço e Status)
  const handleSaveEdit = async () => {
    if (!editingAppointment) return;
    try {
      // Atualiza também o campo barberId, que normalmente permanece o mesmo
      await updateDoc(doc(db, "agendamentos", editingAppointment.id), {
        dateStr: editingAppointment.dateStr,
        timeSlot: editingAppointment.timeSlot,
        service: editingAppointment.service,
        status: editingAppointment.status,
        barber: editingAppointment.barber, // Geralmente, o barbeiro não muda, mas exibimos para conferência
        barberId: editingAppointment.barberId,
      });
      setEditingAppointment(null);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
    }
  };

  // Função para excluir (cancelar) o agendamento
  const handleCancelAppointment = async (appt: Appointment) => {
    if (!confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      await deleteDoc(doc(db, "agendamentos", appt.id));
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
    }
  };

  if (loading || loadingAppointments) {
    return <p>Carregando dados...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Painel do Barbeiro</h1>

      {/* Seção de Filtros */}
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
                    <td className="px-4 py-2 border">
                      <input
                        type="text"
                        value={editingAppointment.barber}
                        disabled
                        className="px-2 py-1 rounded text-black bg-gray-100"
                      />
                    </td>
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
                  // Linha de visualização normal
                  <tr key={app.id}>
                    <td className="px-4 py-2 border">{formatDate(app.dateStr)}</td>
                    <td className="px-4 py-2 border">{app.timeSlot}</td>
                    <td className="px-4 py-2 border">{app.service}</td>
                    <td className="px-4 py-2 border">{app.barber}</td>
                    <td className="px-4 py-2 border">{app.name}</td>
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
    </div>
  );
};

export default BarberDashboard;