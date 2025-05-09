'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import useAuth from '@/hooks/useAuth';

const Header: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Garante que o componente só renderiza conteúdo dinâmico no cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  const isBarber = user?.role === 'barber';
  const isAdmin = user?.role === 'admin';

  // Renderização condicional simplificada para o estado de autenticação
  const renderAuthSection = () => {
    // Se ainda não estamos no cliente, não mostra nada até o componente montar
    if (!isClient) return <span className="text-sm">Carregando...</span>;

    if (loading) {
      return <span className="text-sm">Carregando...</span>;
    }

    if (user) {
      return (
        <>
          <span className="text-sm">{user.name || user.email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-sm px-3 py-1 rounded hover:bg-red-600"
          >
            Sair
          </button>
        </>
      );
    }

    return (
      <>
        <Link href="/login">
          <span className="hover:underline cursor-pointer text-sm">Entrar</span>
        </Link>
        <Link href="/signup">
          <span className="bg-blue-500 text-sm px-3 py-1 rounded hover:underline cursor-pointer">
            Cadastre-se
          </span>
        </Link>
      </>
    );
  };

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
          {isClient && user && !(isBarber || isAdmin) && (
            <Link href="/meus-agendamentos">
              <span className="hover:text-gray-300 cursor-pointer">Meus Agendamentos</span>
            </Link>
          )}
          {isClient && isBarber && (
            <Link href="/barbeiro">
              <span className="hover:text-gray-300 cursor-pointer">Sua Agenda</span>
            </Link>
          )}
          {isClient && isAdmin && (
            <Link href="/admin">
              <span className="hover:text-gray-300 cursor-pointer">Painel</span>
            </Link>
          )}
        </nav>

        {/* Desktop Authentication and Reservar Agora Button */}
        <div className="hidden md:flex items-center space-x-4">
          {renderAuthSection()}
          <Link href="/agendamento">
            <span className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-600 transition cursor-pointer">
              Reservar Agora
            </span>
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden mt-4 flex flex-col space-y-4">
          <Link href="/">
            <span
              className="block py-2 hover:bg-gray-900 px-2 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Início
            </span>
          </Link>
          <Link href="/blog">
            <span
              className="block py-2 hover:bg-gray-900 px-2 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </span>
          </Link>
          <Link href="/sobre">
            <span
              className="block py-2 hover:bg-gray-900 px-2 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Sobre Nós
            </span>
          </Link>
          <Link href="/servicos">
            <span
              className="block py-2 hover:bg-gray-900 px-2 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Serviços
            </span>
          </Link>
          <Link href="/agendamento">
            <span
              className="block py-2 hover:bg-gray-900 px-2 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Reservar
            </span>
          </Link>
          {isClient && user && !(isBarber || isAdmin) && (
            <Link href="/meus-agendamentos">
              <span
                className="block py-2 hover:bg-gray-900 px-2 rounded"
                onClick={() => setIsMenuOpen(false)}
              >
                Meus Agendamentos
              </span>
            </Link>
          )}
          {isClient && isBarber && (
            <Link href="/barbeiro">
              <span
                className="block py-2 hover:bg-gray-900 px-2 rounded"
                onClick={() => setIsMenuOpen(false)}
              >
                Sua Agenda
              </span>
            </Link>
          )}
          {isClient && isAdmin && (
            <Link href="/admin">
              <span
                className="block py-2 hover:bg-gray-900 px-2 rounded"
                onClick={() => setIsMenuOpen(false)}
              >
                Painel
              </span>
            </Link>
          )}

          {/* Mobile Authentication */}
          <div className="pt-4 border-t border-gray-700">
            {!isClient || loading ? (
              <span className="block text-center py-2">Carregando...</span>
            ) : user ? (
              <>
                <span className="block text-center py-2">{user.name || user.email}</span>
                <button
                  onClick={handleLogout}
                  className="w-full text-center py-2 bg-red-500 rounded hover:bg-red-600"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <span
                    className="block text-center py-2 hover:bg-gray-900 rounded"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Entrar
                  </span>
                </Link>
                <Link href="/signup">
                  <span
                    className="block text-center py-2 bg-blue-500 rounded hover:bg-blue-600"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Cadastre-se
                  </span>
                </Link>
              </>
            )}

            <Link href="/agendamento">
              <span
                className="block text-center py-2 mt-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-600"
                onClick={() => setIsMenuOpen(false)}
              >
                Reservar Agora
              </span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
