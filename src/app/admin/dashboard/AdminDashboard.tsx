"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { ExtendedUser } from "@/hooks/useAuth"; // Se você exportou o ExtendedUser no hook

interface Appointment {
  id: string;
  dateStr: string;
  timeSlot: string;
  service: string;
  barber: string;
  name: string; // Nome do cliente ou do usuário que fez o agendamento
  status: string; // "confirmado", "pendente", "cancelado", etc.
}

// Função para converter data de "YYYY-MM-DD" para "DD/MM/YYYY"
const formatDate = (dateStr: string): string => {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const AdminDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  // Estados para os filtros
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterBarber, setFilterBarber] = useState<string>("");

  // Estado para controle da edição inline de um agendamento
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  // Estados para armazenar as opções dos dropdowns
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [barberOptions, setBarberOptions] = useState<string[]>([]);

  // Verifica se o usuário logado possui role "admin"
  useEffect(() => {
    if (!loading && user) {
      if ((user as ExtendedUser).role !== "admin") {
        router.push("/"); // Redireciona caso não seja admin
      }
    }
  }, [loading, user, router]);

  // Busca os agendamentos do Firestore
  useEffect(() => {
    const q = query(collection(db, "agendamentos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsData: Appointment[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        dateStr: docSnap.data().dateStr,
        timeSlot: docSnap.data().timeSlot,
        service: docSnap.data().service,
        barber: docSnap.data().barber,
        name: docSnap.data().name,
        status: docSnap.data().status ? docSnap.data().status : "confirmado",
      }));
      setAppointments(appsData);
      setLoadingAppointments(false);
    });
    return () => unsubscribe();
  }, []);

  // Busca as opções de serviços cadastrados
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

  // Busca as opções dos barbeiros cadastrados (usuários com role "barber")
  useEffect(() => {
    const fetchBarberOptions = async () => {
      try {
        const q = query(collection(db, "usuarios"), where("role", "==", "barber"));
        const snapshot = await getDocs(q);
        const barbers = snapshot.docs.map((doc) => doc.data().name) as string[];
        setBarberOptions(barbers);
      } catch (error) {
        console.error("Erro ao buscar barbeiros:", error);
      }
    };
    fetchBarberOptions();
  }, []);

  // Funções para os botões de data "Hoje" e "Amanhã"
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
    setFilterBarber("");
  };

  // Cria uma lista única de barbeiros a partir dos agendamentos para o filtro
  const uniqueBarbers = Array.from(new Set(appointments.map((app) => app.barber))).sort();

  // Aplica os filtros na lista de agendamentos
  const filteredAppointments = appointments.filter((appt) => {
    const matchDate = filterDate ? appt.dateStr === filterDate : true;
    const matchBarber = filterBarber ? appt.barber === filterBarber : true;
    return matchDate && matchBarber;
  });

  // Função para iniciar a edição de um agendamento
  const handleStartEditing = (appt: Appointment) => {
    setEditingAppointment({ ...appt });
  };

  // Função para descartar a edição
  const handleCancelEdit = () => {
    setEditingAppointment(null);
  };

  // Função para salvar as alterações do agendamento editado
  const handleSaveEdit = async () => {
    if (!editingAppointment) return;
    try {
      await updateDoc(doc(db, "agendamentos", editingAppointment.id), {
        dateStr: editingAppointment.dateStr,
        timeSlot: editingAppointment.timeSlot,
        service: editingAppointment.service,
        barber: editingAppointment.barber,
        status: editingAppointment.status,
      });
      setEditingAppointment(null);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
    }
  };

  // Função para cancelar (excluir) um agendamento definitivamente
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
      <h1 className="text-2xl font-bold mb-4">Dashboard Administrativo</h1>

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
        <div>
          <label className="block mb-1">Filtrar por Barbeiro:</label>
          <select
            value={filterBarber}
            onChange={(e) => setFilterBarber(e.target.value)}
            className="px-3 py-2 bg-gray-200 text-black rounded"
          >
            <option value="">Todos</option>
            {uniqueBarbers.map((barber) => (
              <option key={barber} value={barber}>
                {barber}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
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
            Limpar Filtros
          </button>
        </div>
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
                      <select
                        value={editingAppointment.barber}
                        onChange={(e) =>
                          setEditingAppointment({
                            ...editingAppointment,
                            barber: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded text-black bg-gray-100"
                      >
                        {barberOptions.map((b, idx) => (
                          <option key={idx} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
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

export default AdminDashboard;
