"use client";

import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
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
}

const AdminDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  // Verifica se o usuário logado possui role "admin"
  useEffect(() => {
    if (!loading && user) {
      if ((user as ExtendedUser).role !== "admin") {
        router.push("/"); // redireciona caso não seja admin
      }
    }
  }, [loading, user, router]);

  // Busca os agendamentos do Firestore
  useEffect(() => {
    const q = query(collection(db, "agendamentos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsData: Appointment[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        dateStr: doc.data().dateStr,
        timeSlot: doc.data().timeSlot,
        service: doc.data().service,
        barber: doc.data().barber,
        name: doc.data().name,
      }));
      setAppointments(appsData);
      setLoadingAppointments(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading || loadingAppointments) {
    return <p>Carregando dados...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard Administrativo</h1>
      {appointments.length === 0 ? (
        <p>Nenhum agendamento encontrado.</p>
      ) : (
        <table className="min-w-full border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Data</th>
              <th className="px-4 py-2 border">Horário</th>
              <th className="px-4 py-2 border">Serviço</th>
              <th className="px-4 py-2 border">Barbeiro</th>
              <th className="px-4 py-2 border">Cliente</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((app) => (
              <tr key={app.id}>
                <td className="px-4 py-2 border">{app.dateStr}</td>
                <td className="px-4 py-2 border">{app.timeSlot}</td>
                <td className="px-4 py-2 border">{app.service}</td>
                <td className="px-4 py-2 border">{app.barber}</td>
                <td className="px-4 py-2 border">{app.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminDashboard;