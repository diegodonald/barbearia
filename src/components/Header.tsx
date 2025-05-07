"use client";

import React, { useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";

const Cabecalho: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  // Verifica se o usuário é admin e se é barbeiro
  const isAdmin = user && user.role === "admin";
  const isBarber = user && user.role === "barber";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Redireciona para a página de login após o logout
      router.push("/login");
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  // Função de debugging
  console.log("Navigation render:", { user, loading });

  return (
    <header className="bg-black text-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold text-2xl">
          Barbearia
        </Link>

        {/* Desktop Navigation */}
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
          <Link href="/agendamento">
            <span className="hover:text-gray-300 cursor-pointer">Reservar</span>
          </Link>
          {/* Exibe "Meus Agendamentos" somente se o usuário não for admin nem barbeiro */}
          {user && !(isBarber || isAdmin) && (
            <Link href="/meus-agendamentos">
              <span className="hover:text-gray-300 cursor-pointer">
                Meus Agendamentos
              </span>
            </Link>
          )}
          {isBarber && (
            <Link href="/barbeiro">
              <span className="hover:text-gray-300 cursor-pointer">
                Sua Agenda
              </span>
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin">
              <span className="hover:text-gray-300 cursor-pointer">
                Painel
              </span>
            </Link>
          )}
        </nav>

        {/* Desktop Authentication and Reservar Agora Button */}
        <div className="hidden md:flex items-center space-x-4">
          {loading ? (
            <span>Carregando...</span>
          ) : user ? (
            <>
              <span>{user.name || user.email}</span>
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
          <Link href="/agendamento">
            <span className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-600 transition cursor-pointer">
              Reservar Agora
            </span>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <nav className="md:hidden mt-4">
          <ul className="flex flex-col space-y-4">
            <li>
              <Link href="/">
                <span
                  className="hover:text-gray-300 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Início
                </span>
              </Link>
            </li>
            <li>
              <Link href="/blog">
                <span
                  className="hover:text-gray-300 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </span>
              </Link>
            </li>
            <li>
              <Link href="/sobre">
                <span
                  className="hover:text-gray-300 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sobre Nós
                </span>
              </Link>
            </li>
            <li>
              <Link href="/servicos">
                <span
                  className="hover:text-gray-300 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Serviços
                </span>
              </Link>
            </li>
            <li>
              <Link href="/agendamento">
                <span
                  className="hover:text-gray-300 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Reservar
                </span>
              </Link>
            </li>
            {user && !(isBarber || isAdmin) && (
              <li>
                <Link href="/meus-agendamentos">
                  <span
                    className="hover:text-gray-300 cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Meus Agendamentos
                  </span>
                </Link>
              </li>
            )}
            {isBarber && (
              <li>
                <Link href="/barbeiro">
                  <span
                    className="hover:text-gray-300 cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sua Agenda
                  </span>
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link href="/admin">
                  <span
                    className="hover:text-gray-300 cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Painel
                  </span>
                </Link>
              </li>
            )}
          </ul>
          {/* Mobile Authentication and Reservar Agora Button */}
          <div className="mt-4 flex flex-col space-y-2">
            {loading ? (
              <span>Carregando...</span>
            ) : user ? (
              <>
                <span>{user.name || user.email}</span>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 transition"
                >
                  Sair
                </button>
              </>
            ) : (
              <div className="flex flex-col space-y-2">
                <Link href="/login">
                  <span
                    className="hover:underline cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Entrar
                  </span>
                </Link>
                <Link href="/signup">
                  <span
                    className="bg-blue-500 px-3 py-1 rounded hover:underline cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Cadastre-se
                  </span>
                </Link>
              </div>
            )}
            <Link href="/agendamento">
              <span
                className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-600 transition cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
              >
                Reservar Agora
              </span>
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};

export default Cabecalho;