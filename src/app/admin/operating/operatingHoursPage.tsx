"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import "react-datepicker/dist/react-datepicker.css";

// Atualizada para incluir os campos de intervalo
interface DayConfig {
  open?: string;
  breakStart?: string;
  breakEnd?: string;
  close?: string;
  active: boolean;
}

// A estrutura adotada no Firestore utiliza o campo "horarios" já no nível de documento
export type OperatingHours = {
  horarios: {
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
    domingo: DayConfig;
  };
};

// Interface para Exceções
interface Exception {
  id?: string;
  date: string; // Formato "YYYY-MM-DD"
  status: "blocked" | "available";
  message?: string;
  open?: string;
  close?: string;
}

export default function OperatingHoursPage() {
  const router = useRouter();
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para as exceções
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  // Estado para nova exceção
  const [newException, setNewException] = useState<Exception>({
    date: "",
    status: "blocked",
    message: "",
    open: "",
    close: "",
  });

  // Modificar o useEffect que carrega os dados
  useEffect(() => {
    const docRef = doc(db, "configuracoes", "horarios");
    getDoc(docRef).then((docSnap) => {
      if (docSnap.exists()) {
        setOperatingHours({ horarios: docSnap.data() });
      } else {
        // Cria configuração padrão
        const defaultConfig: OperatingHours = {
          horarios: {
            segunda: { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "17:30", active: true },
            terça:   { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "17:30", active: true },
            quarta:  { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "17:30", active: true },
            quinta:  { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "17:30", active: true },
            sexta:   { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "17:30", active: true },
            sábado:  { open: "08:00", breakStart: "12:00", breakEnd: "13:30", close: "17:30", active: true },
            domingo: { active: false },
          },
        };
        setDoc(docRef, defaultConfig.horarios);
        setOperatingHours(defaultConfig);
      }
      setLoading(false);
    });

    // Listener para as exceções
    const exceptionsRef = collection(db, "configuracoes", "excecoes", "datas");
    const unsubscribe = onSnapshot(exceptionsRef, (snapshot) => {
      const exList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Exception[];
      setExceptions(exList);
    });
    
    return () => unsubscribe();
  }, []);

  // Modificar a função para salvar as configurações globais
  const handleSave = async () => {
    if (!operatingHours) return;
    try {
      // Salvar na coleção configuracoes/horarios
      const docRef = doc(db, "configuracoes", "horarios");
      await setDoc(docRef, operatingHours.horarios);
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar configurações.");
    }
  };

  // Modificar a função para adicionar exceções
  const handleAddException = async () => {
    if (!newException.date) {
      alert("Informe uma data para a exceção.");
      return;
    }
    if (newException.status === "available" && (!newException.open || !newException.close)) {
      alert("Para liberar um dia inativo, informe os horários de abertura e fechamento.");
      return;
    }
    try {
      // Salvar na coleção configuracoes/excecoes/datas
      const exceptionsRef = doc(db, "configuracoes", "excecoes", "datas", newException.date);
      await setDoc(exceptionsRef, newException);
      setNewException({ date: "", status: "blocked", message: "", open: "", close: "" });
    } catch (error) {
      console.error("Erro ao adicionar exceção:", error);
    }
  };

  // Modificar a função para remover exceções
  const handleDeleteException = async (exceptionId: string) => {
    try {
      const exceptionDocRef = doc(db, "configuracoes", "excecoes", "datas", exceptionId);
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

  // Função para renderizar o formulário de cada dia com os 4 campos (abertura, início intervalo, término intervalo e fechamento)
  const renderDayForm = (dayName: keyof OperatingHours["horarios"]) => {
    const dayConfig = operatingHours.horarios[dayName];
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
                horarios: {
                  ...operatingHours.horarios,
                  [dayName]: { ...dayConfig, active: e.target.checked },
                },
              })
            }
          />
        </div>
        {dayConfig.active && (
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block">Horário de Abertura:</label>
              <input
                type="time"
                value={dayConfig.open || ""}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    horarios: {
                      ...operatingHours.horarios,
                      [dayName]: { ...dayConfig, open: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label className="block">Início do Intervalo:</label>
              <input
                type="time"
                value={dayConfig.breakStart || ""}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    horarios: {
                      ...operatingHours.horarios,
                      [dayName]: { ...dayConfig, breakStart: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label className="block">Término do Intervalo:</label>
              <input
                type="time"
                value={dayConfig.breakEnd || ""}
                onChange={(e) =>
                  setOperatingHours({
                    ...operatingHours,
                    horarios: {
                      ...operatingHours.horarios,
                      [dayName]: { ...dayConfig, breakEnd: e.target.value },
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
                    horarios: {
                      ...operatingHours.horarios,
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
      {/* Botão Voltar alinhado à esquerda */}
      <div className="px-4 pt-6">
        <button
          onClick={() => router.back()}
          className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600 transition text-white"
        >
          Voltar
        </button>
      </div>
      <main className="py-20 px-4">
        <h1 className="text-3xl font-bold mb-6">Configuração de Horários</h1>

        {/* Seção de Horários Globais */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">
            Horários Globais de Funcionamento
          </h2>
          {(Object.keys(operatingHours.horarios) as (keyof OperatingHours["horarios"])[]).map(
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
          <h2 className="text-2xl font-semibold mb-4">
            Exceções (Datas Específicas)
          </h2>

          {/* Formulário para Adicionar Exceção */}
          <div className="mb-4 p-4 border rounded bg-gray-800">
            <div className="flex gap-4 items-center mb-2">
              <label className="mr-2">Data da Exceção:</label>
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
              <label className="mr-2">Estado:</label>
              <select
                value={newException.status}
                onChange={(e) =>
                  setNewException({
                    ...newException,
                    status: e.target.value as "blocked" | "available",
                  })
                }
                className="px-2 py-1 text-black rounded"
              >
                <option value="blocked">Bloqueado</option>
                <option value="available">Liberado</option>
              </select>
            </div>
            {newException.status === "available" && (
              <div className="flex flex-wrap gap-4 items-center mb-2">
                <div>
                  <label className="block">Abertura:</label>
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
                  <label className="block">Fechamento:</label>
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

          {/* Listagem das Exceções Existentes */}
          <section>
            <h3 className="text-xl font-semibold mb-2">
              Exceções Existentes:
            </h3>
            {exceptions.length === 0 ? (
              <p>Nenhuma exceção cadastrada.</p>
            ) : (
              <ul className="space-y-2">
                {exceptions.map((ex) => (
                  <li
                    key={ex.id}
                    className="flex justify-between items-center bg-gray-700 p-2 rounded"
                  >
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
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
}