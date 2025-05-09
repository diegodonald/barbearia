'use client';

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';

const Login: React.FC = () => {
  // Estados para email, senha, visibilidade da senha e mensagem de erro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Limpa erro anterior
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      // Verifica se o erro está relacionado a credenciais inválidas
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-email' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Usuário ou senha incorretos. Por favor, tente novamente.');
      } else {
        setError('Ocorreu um erro inesperado ao tentar efetuar o login.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Conteúdo Principal */}
      <main className="flex flex-col items-center justify-center flex-grow py-20 px-4">
        <form onSubmit={handleLogin} className="bg-gray-900 p-6 rounded shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-semibold mb-4 text-center">Entrar</h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          {/* Campo de Email */}
          <div className="mb-4">
            <input
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Grupo do Campo de Senha (Input + Botão de Visualização) */}
          <div className="mb-4">
            <div className="flex border border-gray-700 rounded overflow-hidden">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="flex-grow p-2 bg-gray-800 text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="w-12 flex items-center justify-center bg-gray-800 text-gray-400 transition duration-300 hover:bg-gray-700"
              >
                {showPassword ? (
                  // Ícone para ocultar a senha (EyeOff)
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.086.18-2.133.513-3.105M6.343 6.343a8 8 0 0111.314 0M16.24 16.24A8 8 0 018.76 8.76m2.121 2.121L3 3m18 18l-3.197-3.197"
                    />
                  </svg>
                ) : (
                  // Ícone para mostrar a senha (Eye)
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-500 text-black p-2 rounded hover:bg-yellow-600 transition"
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
