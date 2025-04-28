"use client";

import React, { useState, useEffect } from "react";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

const Agendamento: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Se não estiver carregando e não houver usuário autenticado, redireciona para o login
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Campos do formulário para agendamento
  const [data, setData] = useState("");
  const [servico, setServico] = useState("");
  const [barbeiro, setBarbeiro] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aqui, os dados do agendamento serão associados ao usuário logado (user.email)
    console.log("Dados do agendamento:", {
      email: user?.email,
      data,
      servico,
      barbeiro,
    });
    alert("Agendamento enviado! Confira o console para detalhes.");
  };

  // Enquanto o carregamento ou redirecionamento estão ocorrendo, exibe uma mensagem de carregamento
  if (loading || !user) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Agendamento</h1>
      {/* Exibindo o email do usuário logado */}
      <div className="max-w-3xl mx-auto bg-white p-4 rounded shadow mb-6">
        <p className="text-lg">
          Agendamento para: <strong>{user.email}</strong>
        </p>
      </div>
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Data do Agendamento</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="border px-3 py-2 rounded w-full"
              required
            />
          </div>
          <div>
            <label className="block mb-1">Serviço</label>
            <select
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              className="border px-3 py-2 rounded w-full"
              required
            >
              <option value="">Selecione o serviço</option>
              <option value="corte">Corte</option>
              <option value="barba">Barba</option>
              <option value="corte e barba">Corte e Barba</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">Barbeiro</label>
            <select
              value={barbeiro}
              onChange={(e) => setBarbeiro(e.target.value)}
              className="border px-3 py-2 rounded w-full"
              required
            >
              <option value="">Selecione o barbeiro</option>
              <option value="barbeiro1">Barbeiro 1</option>
              <option value="barbeiro2">Barbeiro 2</option>
              <option value="barbeiro3">Barbeiro 3</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded w-full"
          >
            Agendar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Agendamento;