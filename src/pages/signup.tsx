import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/router";

const Signup: React.FC = () => {
  // Estados para armazenar email, senha e possíveis erros
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Função para tratar o envio do formulário
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Tenta criar um usuário com email e senha
      await createUserWithEmailAndPassword(auth, email, password);
      // Se der tudo certo, redireciona para a página inicial
      router.push("/");
    } catch (err: any) {
      // Em caso de erro, armazena a mensagem de erro para exibição
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSignup} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl mb-4 text-center">Cadastre-se</h2>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
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
