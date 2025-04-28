"use client";

import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";

const Signup: React.FC = () => {
  // Novo estado para armazenar o nome do usuário
  const [name, setName] = useState("");
  // Estados para email, senha e possíveis erros
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Função para tratar o envio do formulário
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Cria o usuário no Firebase Auth e obtem as credenciais
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Cria o documento na coleção "usuarios" no Firestore com o nome incluído
      await setDoc(doc(db, "usuarios", user.uid), {
        name, // salva o nome do usuário
        email: user.email,
        createdAt: new Date(),
        // Adicione outros campos se necessário
      });

      // Redireciona para a página inicial ou para outra rota desejada
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSignup} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl mb-4 text-center">Cadastre-se</h2>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        {/* Campo para o nome */}
        <input
          type="text"
          placeholder="Digite seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border p-2 w-full mb-4"
        />
        <input
          type="email"
          placeholder="Digite seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border p-2 w-full mb-4"
        />
        <input
          type="password"
          placeholder="Digite sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border p-2 w-full mb-4"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">
          Cadastrar
        </button>
      </form>
    </div>
  );
};

export default Signup;