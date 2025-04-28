"use client";

import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import useAuth from "@/hooks/useAuth";

const Cabecalho: React.FC = () => {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  return (
    <header className="bg-black text-white flex justify-between items-center px-6 py-4">
      {/* Parte esquerda: logotipo e menu de navegação */}
      <div className="flex items-center space-x-8">
        <Link href="/" className="font-bold text-2xl">
          Barbearia
        </Link>
        <nav className="hidden md:flex space-x-6">
          <Link href="/">
            <span className="hover:text-gray-300 cursor-pointer">Início</span>
          </Link>
          <Link href="/blog">
            <span className="hover:text-gray-300 cursor-pointer">Blog</span>
          </Link>
          <Link href="/sobre">
            <span className="hover:text-gray-300 cursor-pointer">Sobre Nós</span>
          </Link>
          <Link href="/servicos">
            <span className="hover:text-gray-300 cursor-pointer">Serviços</span>
          </Link>
          <Link href="/reservar">
            <span className="hover:text-gray-300 cursor-pointer">Reservar</span>
          </Link>
        </nav>
      </div>
      {/* Parte direita: autenticação e botão "Reservar Agora" */}
      <div className="flex items-center space-x-4">
        {loading ? (
          <span>Carregando...</span>
        ) : user ? (
          <>
            <span className="hidden md:inline">{user.displayName}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
            >
              Sair
            </button>
          </>
        ) : (
          <>
            <Link href="/login">
              <span className="hover:underline cursor-pointer">Entrar</span>
            </Link>
            <Link href="/signup">
              <span className="bg-blue-500 px-3 py-1 rounded hover:underline cursor-pointer">
                Cadastre-se
              </span>
            </Link>
          </>
        )}
        <Link href="/reservar">
          <span className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-600 transition cursor-pointer">
            Reservar Agora
          </span>
        </Link>
      </div>
    </header>
  );
};

export default Cabecalho;
