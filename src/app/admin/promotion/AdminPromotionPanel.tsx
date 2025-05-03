"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";
import { useOperatingHours } from "@/hooks/useOperatingHours";

// Define uma interface para os dados do usuário
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// --- Interfaces e Configuração de Agenda ---
// Os dias estão definidos diretamente, sem "diasSemana"
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

export interface BarberConfig {
  horarios: {
    domingo: DayConfig;
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
  };
  exceptions?: Exception[];
}

interface Exception {
  id?: string;
  date: string; // formato "YYYY-MM-DD"
  status: "blocked" | "available";
  message?: string;
  open?: string;
  close?: string;
}

// Fallback fixo – usado se a Agenda Global não estiver disponível
const fallbackConfig: BarberConfig = {
  horarios: {
    segunda: { open: "08:00", close: "18:00", active: true },
    terça: { open: "08:00", close: "18:00", active: true },
    quarta: { open: "08:00", close: "18:00", active: true },
    quinta: { open: "08:00", close: "18:00", active: true },
    sexta: { open: "08:00", close: "18:00", active: true },
    sábado: { open: "09:00", close: "14:00", active: true },
    domingo: { active: false },
  },
  exceptions: [],
};

const AdminPromotionPanel: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Obter dados atuais da Agenda Global
  const { operatingHours } = useOperatingHours();

  // Helper: retorna a configuração global "achatada"
  const getGlobalHorarios = (): any => {
    if (operatingHours) {
      // Se existir a chave "diasSemana", retorna seu valor; senão, retorna operatingHours diretamente
      return operatingHours.diasSemana ? operatingHours.diasSemana : operatingHours;
    }
    return fallbackConfig.horarios;
  };

  // Estado para armazenar a lista de usuários
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");

  // Estado para filtro por nome
  const [filterName, setFilterName] = useState("");

  // Verificar se o usuário logado possui role "admin"
  useEffect(() => {
    if (!loading && user) {
      if (user.role !== "admin") {
        router.push("/"); // Redireciona se não for admin
      }
    }
  }, [loading, user, router]);

  // Busca os usuários da coleção "usuarios" do Firestore
  useEffect(() => {
    const q = query(collection(db, "usuarios"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as User[];
        setUsers(usersData);
        setLoadingUsers(false);
      },
      (error) => {
        console.error("Erro ao buscar usuários:", error);
        setError("Erro ao buscar usuários.");
        setLoadingUsers(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Função para alterar a role do usuário para o valor especificado.
  // Ao promover para "barber", atualiza o documento para incluir a agenda individual com os dados ATUAIS da Agenda Global.
  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const userDocRef = doc(db, "usuarios", userId);
      if (newRole === "barber") {
        const docSnap = await getDoc(userDocRef);
        const userData = docSnap.exists() ? docSnap.data() : {};
        // Remover a chave "horarios" do objeto antigo, se existir, para evitar duplicação
        if (userData.horarios) {
          delete userData.horarios;
        }
        // Use a agenda global atualizada – preservando a estrutura sob a chave "horarios"
        const globalConfig =
          operatingHours && operatingHours.horarios
            ? operatingHours.horarios
            : fallbackConfig.horarios;
        await setDoc(
          userDocRef,
          {
            ...userData, // preserva os outros campos do documento (ex: nome, email)
            horarios: globalConfig, // sobrescreve completamente o campo "horarios"
            exceptions: []
          },
          { merge: false }
        );
        alert("Usuário promovido a Barbeiro com agenda herdada da Agenda Global.");
      } else {
        alert(`Usuário atualizado para ${newRole === "admin" ? "Admin" : "Cliente"} com sucesso!`);
      }
      await updateDoc(userDocRef, { role: newRole });
      await updateDoc(userDocRef, { role: newRole });
    } catch (error) {
      console.error("Erro ao atualizar role do usuário:", error);
      setError("Erro ao atualizar role do usuário.");
    }
  };

  if (loading || loadingUsers) {
    return <p>Carregando...</p>;
  }

  // Aplica o filtro por nome
  const filteredUsers = users.filter((u) => {
    const matchName = filterName
      ? u.name.toLowerCase().includes(filterName.toLowerCase())
      : true;
    return matchName;
  });

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        Painel Administrativo – Gerenciamento de Usuários
      </h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Filtro por Nome */}
      <div className="mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block mb-1">Filtrar por Nome:</label>
          <input
            type="text"
            placeholder="Digite o nome do usuário"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="px-3 py-2 bg-gray-200 text-black rounded"
          />
        </div>
        <button
          onClick={() => setFilterName("")}
          className="bg-gray-500 px-3 py-2 rounded hover:bg-gray-600 transition"
        >
          Limpar Filtro de Nome
        </button>
      </div>

      {filteredUsers.length === 0 ? (
        <p>Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border">Nome</th>
                <th className="px-4 py-2 border">Email</th>
                <th className="px-4 py-2 border">Role</th>
                <th className="px-4 py-2 border">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 border">{u.name}</td>
                  <td className="px-4 py-2 border">{u.email}</td>
                  <td className="px-4 py-2 border">{u.role}</td>
                  <td className="px-4 py-2 border">
                    {u.role === "user" ? (
                      <>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deseja promover ${u.name} a Barbeiro?`
                              )
                            ) {
                              changeUserRole(u.id, "barber");
                            }
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mr-2"
                        >
                          Promover a Barbeiro
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(`Deseja promover ${u.name} a Admin?`)
                            ) {
                              changeUserRole(u.id, "admin");
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                        >
                          Promover a Admin
                        </button>
                      </>
                    ) : u.role === "barber" ? (
                      <>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deseja rebaixar ${u.name} para Cliente?`
                              )
                            ) {
                              changeUserRole(u.id, "user");
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded mr-2"
                        >
                          Rebaixar para Cliente
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deseja promover ${u.name} a Admin?`
                              )
                            ) {
                              changeUserRole(u.id, "admin");
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                        >
                          Promover a Admin
                        </button>
                      </>
                    ) : u.role === "admin" ? (
                      <>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deseja rebaixar ${u.name} para Barbeiro?`
                              )
                            ) {
                              changeUserRole(u.id, "barber");
                            }
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded mr-2"
                        >
                          Rebaixar para Barbeiro
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deseja rebaixar ${u.name} para Cliente?`
                              )
                            ) {
                              changeUserRole(u.id, "user");
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                        >
                          Rebaixar para Cliente
                        </button>
                      </>
                    ) : (
                      <span>Sem ação</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPromotionPanel;