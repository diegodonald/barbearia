'use client';

import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { doc, setDoc } from 'firebase/firestore';
import Footer from '@/components/Footer';

const Signup: React.FC = () => {
  // Estado para armazenar o nome do usuário
  const [name, setName] = useState('');
  // Estados para email, senha, confirmação e possíveis erros
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // Função para tratar o envio do formulário
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    try {
      // Cria o usuário no Firebase Auth e obtém as credenciais
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Cria o documento na coleção "usuarios" no Firestore com o nome e define a role padrão "user"
      await setDoc(doc(db, 'usuarios', user.uid), {
        name, // salva o nome do usuário
        email: user.email,
        createdAt: new Date(),
        role: 'user', // define o role padrão para "user"
      });

      // Redireciona para a página inicial ou para outra rota desejada
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro inesperado.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Conteúdo Principal */}
      <main className="flex flex-col items-center justify-center flex-grow py-20 px-4">
        <form onSubmit={handleSignup} className="bg-gray-900 p-6 rounded shadow-md w-full max-w-sm">
          <h2 className="text-2xl mb-4 text-center">Cadastre-se</h2>
          {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

          {/* Campo para o nome */}
          <input
            type="text"
            placeholder="Digite seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 px-3 py-2 w-full mb-4 rounded focus:outline-none focus:border-yellow-500"
          />
          {/* Campo para o email */}
          <input
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 px-3 py-2 w-full mb-4 rounded focus:outline-none focus:border-yellow-500"
          />
          {/* Campo para a senha */}
          <input
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 px-3 py-2 w-full mb-4 rounded focus:outline-none focus:border-yellow-500"
          />
          {/* Campo para a confirmação de senha */}
          <input
            type="password"
            placeholder="Confirme sua senha"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            className="bg-gray-800 border border-gray-700 px-3 py-2 w-full mb-6 rounded focus:outline-none focus:border-yellow-500"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 w-full rounded hover:bg-blue-600 transition"
          >
            Cadastrar
          </button>
        </form>
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
};

export default Signup;
