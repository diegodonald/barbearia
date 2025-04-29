"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Login: React.FC = () => {
  // Estados para armazenar email, senha e possíveis erros
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Função para tratar o envio do formulário de login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro inesperado ao tentar efetuar o login.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Cabeçalho */}
      <Header />

      {/* Conteúdo Principal */}
      <main className="flex flex-col items-center justify-center flex-grow py-20 px-4">
        <form
          onSubmit={handleLogin}
          className="bg-gray-900 p-6 rounded shadow-md w-full max-w-sm"
        >
          <h2 className="text-2xl mb-4 text-center">Entrar</h2>
          {error && (
            <p className="text-red-500 mb-4 text-center">{error}</p>
          )}
          <input
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 p-2 w-full mb-4 rounded focus:outline-none focus:border-yellow-500"
          />
          <input
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 p-2 w-full mb-4 rounded focus:outline-none focus:border-yellow-500"
          />
          <button
            type="submit"
            className="bg-yellow-500 text-black p-2 w-full rounded hover:bg-yellow-600 transition"
          >
            Entrar
          </button>
        </form>
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
};

export default Login;
