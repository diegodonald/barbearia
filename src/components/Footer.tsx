"use client";

import Link from "next/link";
import useAuth from "@/hooks/useAuth";

export default function Footer() {
  const { user } = useAuth();

  // Verifica se o usuário é admin ou barbeiro
  const isAdmin = user && user.role === "admin";
  const isBarber = user && user.role === "barber";

  return (
    <footer className="bg-black text-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Links de Navegação */}
        <nav className="flex justify-center space-x-6 mb-4">
          <Link href="/">
            <span className="hover:text-gray-400 cursor-pointer">Início</span>
          </Link>
          <Link href="/blog">
            <span className="hover:text-gray-400 cursor-pointer">Blog</span>
          </Link>
          <Link href="/sobre">
            <span className="hover:text-gray-400 cursor-pointer">Sobre Nós</span>
          </Link>
          <Link href="/servicos">
            <span className="hover:text-gray-400 cursor-pointer">Serviços</span>
          </Link>
          <Link href="/reservar">
            <span className="hover:text-gray-400 cursor-pointer">Reservar</span>
          </Link>
          {/* Exibe "Meus Agendamentos" para usuários que não são admin nem barbeiro */}
          {user && !(isBarber || isAdmin) && (
            <Link href="/meus-agendamentos">
              <span className="hover:text-gray-400 cursor-pointer">Meus Agendamentos</span>
            </Link>
          )}
          {/* Exibe "Sua Agenda" para usuários Barbeiros */}
          {isBarber && (
            <Link href="/barbeiro">
              <span className="hover:text-gray-400 cursor-pointer">Sua Agenda</span>
            </Link>
          )}
        </nav>

        {/* Formulário de Inscrição */}
        <div className="text-center mb-4">
          <p className="mb-2">Inscreva-se para receber novidades:</p>
          <form className="flex flex-col sm:flex-row justify-center items-center">
            <input
              type="email"
              placeholder="Digite seu email"
              className="px-4 py-2 rounded-l outline-none"
            />
            <button
              type="submit"
              className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-r hover:bg-yellow-600 transition mt-2 sm:mt-0"
            >
              Inscrever-se
            </button>
          </form>
        </div>

        {/* Disclaimer e Redes Sociais */}
        <div className="text-center text-sm">
          <p>
            Este formulário é protegido por reCAPTCHA. A Política de Privacidade e os Termos de Serviço do Google se aplicam.
          </p>
          <div className="flex justify-center space-x-4 mt-2">
            <a href="#" className="hover:text-gray-400">
              Facebook
            </a>
            <a href="#" className="hover:text-gray-400">
              Instagram
            </a>
            <a href="#" className="hover:text-gray-400">
              Twitter
            </a>
          </div>
          <p className="mt-2">&copy; 2025 Barbearia. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}