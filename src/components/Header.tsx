// src/components/Header.tsx
import React from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import useAuth from "@/hooks/useAuth";

const Header: React.FC = () => {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  return (
    <header className="bg-gray-800 text-white flex justify-between p-4">
      {/* Removemos o <a> e passamos as classes no próprio Link */}
      <Link href="/" className="font-bold text-lg">
        Barbearia
      </Link>
      <nav>
        {loading ? (
          <span>Carregando...</span>
        ) : user ? (
          <>
            <span className="mr-4">{user.email}</span>
            <button onClick={handleLogout} className="bg-red-500 px-3 py-1 rounded">
              Sair
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="mr-4 hover:underline">Entrar</Link>
            <Link href="/signup" className="bg-blue-500 px-3 py-1 rounded hover:underline">
              Cadastre-se
            </Link>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header;
