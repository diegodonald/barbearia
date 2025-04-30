"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import "react-datepicker/dist/react-datepicker.css";

// Define a interface para um dia da semana
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

// Interface para as configurações globais de horários
export type OperatingHours = {
  diasSemana: {
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
    domingo: DayConfig;
  };
};

// Atualize a interface de exceção para incluir, se necessário, os horários (caso a exceção libere um dia inativo)
interface Exception {
  id?: string;
  date: string;    // formato "YYYY-MM-DD"
  status: "blocked" | "available";
  message?: string;
  open?: string;   // horário de abertura para exceção (opcional)
  close?: string;  // horário de fechamento para exceção (opcional)
}

export default function OperatingHoursPage() {
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para as exceções
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  // Ao criar uma nova exceção, se o status for "available", poderemos definir os horários
  const [newException, setNewException] = useState<Exception>({
    date: "",
    status: "blocked",
    message: "",
    open: "",
    close: "",
  });

  // Buscar configurações globais no Firestore
  useEffect(() => {
    const docRef = doc(db, "configuracoes", "operatingHours");
    getDoc(docRef).then((docSnap) => {
      if (docSnap.exists()) {
        setOperatingHours(docSnap.data() as OperatingHours);
      } else {
        // Cria configuração padrão caso não exista
        const defaultConfig: OperatingHours = {
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
        setDoc(docRef, defaultConfig);
        setOperatingHours(defaultConfig);
      }
      setLoading(false);
    });

    // Configura listener para as exceções (subcoleção)
    const exceptionsRef = collection(db, "configuracoes", "operatingHours", "exceptions");
    const unsubscribe = onSnapshot(exceptionsRef, (snapshot) => {
      const exList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } )) as Exception[];
      setExceptions(exList);
    });
    return () => unsubscribe();
  }, []);

  // Função para salvar as configurações globais
  const handleSave = async () => {
    if (!operatingHours) return;
    try {
      const docRef = doc(db, "configuracoes", "operatingHours");
      await updateDoc(docRef, operatingHours);
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar configurações.");
    }
  };

  // Função para adicionar nova exceção
  const handleAddException = async () => {
    if (!newException.date) {
      alert("Informe uma data para a exceção.");
      return;
    }
    // Se o status for "available", verifique se os horários foram informados (para liberar um dia inativo)
    if (newException.status === "available" && (!newException.open || !newException.close)) {
      alert("Para liberar um dia inativo, informe os horários de abertura e fechamento.");
      return;
    }
    try {
      const exceptionsRef = collection(db, "configuracoes", "operatingHours", "exceptions");
      await addDoc(exceptionsRef, newException);
      setNewException({ date: "", status: "blocked", message: "", open: "", close: "" });
    } catch (error) {
      console.error("Erro ao adicionar exceção:", error);
    }
  };

  // Função para remover exceção
  const handleDeleteException = async (exceptionId: string) => {
    try {
      const exceptionDocRef = doc(db, "configuracoes", "operatingHours", "exceptions", exceptionId);
      await deleteDoc(exceptionDocRef);
    } catch (error) {
      console.error("Erro ao deletar exceção:", error);
    }
  };

  if (loading || !operatingHours) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Carregando configurações...</p>
      </div>
    );
  }

  // Função para renderizar o formulário de cada dia
  const renderDayForm = (dayName: keyof OperatingHours["diasSemana"]) => {
    const dayConfig = operatingHours.diasSemana[dayName];
    return (
      <div key={dayName} className="mb-4 p-4 border rounded bg-gray-800">
        <h3 className="text-lg capitalize mb-2">{dayName}</h3>
        <div className="flex items-center mb-2">
          <label className="mr-2">Ativo?</label>
          <input
            type="checkbox"
            checked={dayConfig.active}
            onChange={(e) =>
              setOperatingHours({
                ...operatingHours,
                diasSemana: {
                  ...operatingHours.diasSemana,
                  [dayName]: { ...dayConfig, active: e.target.checked },
                },
              })
            }
          />
        </div>
        {dayConfig.active && (
          <div className="flex gap-4">
            <div>
              <label className="block">Horário de Abertura:</label>
              <input
                type="time"
                value={dayConfig.open || ""}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    diasSemana: {
                      ...operatingHours.diasSemana,
                      [dayName]: { ...dayConfig, open: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label className="block">Horário de Fechamento:</label>
              <input
                type="time"
                value={dayConfig.close || ""}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    diasSemana: {
                      ...operatingHours.diasSemana,
                      [dayName]: { ...dayConfig, close: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <h1 className="text-3xl font-bold mb-6">Configuração de Horários</h1>

        {/* Seção de Horários Globais */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Horários Globais de Funcionamento</h2>
          {(Object.keys(operatingHours.diasSemana) as (keyof OperatingHours["diasSemana"])[]).map(
            (day) => renderDayForm(day)
          )}
          <button
            onClick={handleSave}
            className="mt-4 bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Salvar Configurações
          </button>
        </section>

        {/* Seção de Exceções */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Exceções (Datas Específicas)</h2>
          <div className="mb-4">
            <div className="flex gap-4 items-center mb-2">
              <label className="block">Data da Exceção:</label>
              <input
                type="date"
                value={newException.date}
                onChange={(e) =>
                  setNewException({ ...newException, date: e.target.value })
                }
                className="px-2 py-1 text-black rounded"
              />
            </div>
            <div className="flex gap-4 items-center mb-2">
              <label>Estado:</label>
              <select
                value={newException.status}
                onChange={(e) =>
                  setNewException({ ...newException, status: e.target.value as "blocked" | "available" })
                }
                className="px-2 py-1 text-black rounded"
              >
                <option value="blocked">Bloqueado</option>
                <option value="available">Liberado</option>
              </select>
            </div>
            {/* Se o status for "available", exibe inputs para definir os horários */}
            {newException.status === "available" && (
              <div className="flex gap-4 items-center mb-2">
                <div>
                  <label className="block">Horário de Abertura:</label>
                  <input
                    type="time"
                    value={newException.open || ""}
                    onChange={(e) =>
                      setNewException({ ...newException, open: e.target.value })
                    }
                    className="px-2 py-1 text-black rounded"
                  />
                </div>
                <div>
                  <label className="block">Horário de Fechamento:</label>
                  <input
                    type="time"
                    value={newException.close || ""}
                    onChange={(e) =>
                      setNewException({ ...newException, close: e.target.value })
                    }
                    className="px-2 py-1 text-black rounded"
                  />
                </div>
              </div>
            )}
            <div className="mb-2">
              <label className="block">Mensagem (opcional):</label>
              <input
                type="text"
                value={newException.message}
                onChange={(e) =>
                  setNewException({ ...newException, message: e.target.value })
                }
                className="w-full px-2 py-1 text-black rounded"
              />
            </div>
            <button
              onClick={handleAddException}
              className="bg-green-500 px-4 py-2 rounded hover:bg-green-600 transition"
            >
              Adicionar Exceção
            </button>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Exceções Existentes:</h3>
            {exceptions.length === 0 ? (
              <p>Nenhuma exceção cadastrada.</p>
            ) : (
              <ul>
                {exceptions.map((ex) => (
                  <li key={ex.id} className="mb-2 flex justify-between items-center bg-gray-800 p-2 rounded">
                    <span>
                      {ex.date} — {ex.status}{" "}
                      {ex.status === "available" && ex.open && ex.close
                        ? `(Abertura: ${ex.open}, Fechamento: ${ex.close})`
                        : ""}{" "}
                      {ex.message ? `(${ex.message})` : ""}
                    </span>
                    <button
                      onClick={() => ex.id && handleDeleteException(ex.id)}
                      className="bg-red-500 px-2 py-1 rounded hover:bg-red-600 transition"
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}