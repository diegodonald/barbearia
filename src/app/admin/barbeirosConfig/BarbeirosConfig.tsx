"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Interfaces para a configuração individual do barbeiro
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

export interface BarberConfig {
  horarios: {
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
    domingo: DayConfig;
  };
  exceptions?: Exception[];
}

interface Exception {
  id?: string;
  date: string; // Formato "YYYY-MM-DD"
  status: "blocked" | "available";
  message?: string;
  open?: string;
  close?: string;
}

interface BarberOption {
  id: string;
  name: string;
}

const BarbeirosConfig: React.FC = () => {
  // Lista de barbeiros disponíveis
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");
  // Configuração individual do barbeiro selecionado
  const [barberConfig, setBarberConfig] = useState<BarberConfig | null>(null);
  // Estado de carregamento e feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>("");

  // Carregar a lista de barbeiros com role "barber"
  useEffect(() => {
    async function fetchBarbers() {
      try {
        const q = await getDocs(collection(db, "usuarios"));
        const barbers = q.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as any),
          }))
          .filter((user) => user.role === "barber")
          .map((user) => ({ id: user.id, name: user.name }));
        setBarberOptions(barbers);
      } catch (error) {
        console.error("Erro ao buscar barbeiros:", error);
      }
    }
    fetchBarbers();
  }, []);

  // Carregar a configuração individual do barbeiro selecionado
  useEffect(() => {
    if (!selectedBarberId) return;
    setLoading(true);
    const docRef = doc(db, "usuarios", selectedBarberId);
    getDoc(docRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.horarios) {
            setBarberConfig({
              horarios: data.horarios,
              exceptions: data.exceptions || [],
            });
          } else {
            // Configuração padrão se inexistente
            const defaultConfig: BarberConfig = {
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
            setBarberConfig(defaultConfig);
          }
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar a configuração do barbeiro:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedBarberId]);

  // Função para salvar a configuração individual
  const saveConfig = async () => {
    if (!selectedBarberId || !barberConfig) return;
    try {
      const docRef = doc(db, "usuarios", selectedBarberId);
      await updateDoc(docRef, { horarios: barberConfig.horarios, exceptions: barberConfig.exceptions || [] });
      setFeedback("Configurações salvas com sucesso!");
    } catch (error) {
      console.error(error);
      setFeedback("Erro ao salvar configurações.");
    }
  };

  // Renderizar o formulário para cada dia da semana
  const renderDayForm = (day: keyof BarberConfig["horarios"]) => {
    if (!barberConfig) return null;
    const config = barberConfig.horarios[day];
    return (
      <div key={day} className="mb-4 p-4 border rounded bg-gray-800">
        <h3 className="text-lg capitalize mb-2">{day}</h3>
        <div className="flex items-center mb-2">
          <label className="mr-2">Ativo?</label>
          <input
            type="checkbox"
            checked={config.active}
            onChange={(e) =>
              setBarberConfig({
                ...barberConfig,
                horarios: {
                  ...barberConfig.horarios,
                  [day]: { ...config, active: e.target.checked },
                },
              })
            }
          />
        </div>
        {config.active && (
          <div className="flex gap-4">
            <div>
              <label className="block">Horário de Abertura:</label>
              <input
                type="time"
                value={config.open || ""}
                onChange={(e) =>
                  setBarberConfig({
                    ...barberConfig,
                    horarios: {
                      ...barberConfig.horarios,
                      [day]: { ...config, open: e.target.value },
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
                value={config.close || ""}
                onChange={(e) =>
                  setBarberConfig({
                    ...barberConfig,
                    horarios: {
                      ...barberConfig.horarios,
                      [day]: { ...config, close: e.target.value },
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
    <div>
      <h1 className="text-3xl font-bold mb-6">Configuração Individual do Barbeiro</h1>
      
      {/* Seletor de Barbeiro */}
      <div className="mb-6">
        <label className="block mb-1">Selecione o Barbeiro:</label>
        <select
          value={selectedBarberId}
          onChange={(e) => {
            setSelectedBarberId(e.target.value);
            setFeedback("");
          }}
          className="px-3 py-2 bg-gray-200 text-black rounded"
        >
          <option value="">Selecione um barbeiro</option>
          {barberOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Carregando configuração...</p>
      ) : barberConfig ? (
        <>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Horários Semanais</h2>
            {(Object.keys(barberConfig.horarios) as (keyof BarberConfig["horarios"])[]).map((day) =>
              renderDayForm(day)
            )}
          </section>

          {/* Seção de Exceções */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Exceções</h2>
            <p>Funcionalidade de exceções em desenvolvimento...</p>
          </section>

          <button
            onClick={saveConfig}
            className="mt-6 bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Salvar Configuração
          </button>

          {feedback && <p className="mt-4 text-center text-green-500">{feedback}</p>}
        </>
      ) : (
        <p>Nenhuma configuração encontrada para este barbeiro.</p>
      )}
    </div>
  );
};

export default BarbeirosConfig;