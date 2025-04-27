// src/pages/test-auth.tsx

import React from "react";
import useAuth from "@/hooks/useAuth";

const TestAuth: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Carregando estado de autenticação...</p>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl">
        {user ? `Usuário autenticado: ${user.email}` : "Nenhum usuário autenticado."}
      </h1>
    </div>
  );
};

export default TestAuth;
