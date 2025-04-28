"use client";

import React, { useEffect } from "react";
import useAuth, { ExtendedUser } from "@/hooks/useAuth";

const TestAuth: React.FC = () => {
  const { user, loading, error } = useAuth();

  useEffect(() => {
    console.log("Usuário autenticado:", user);
  }, [user]);

  if (loading) return <p>Carregando...</p>;
  if (error) return <p>Erro: {error.message}</p>;
  if (!user) return <p>Nenhum usuário logado.</p>;

  return (
    <div>
      <h2>Dados do Usuário</h2>
      <p>Nome: {(user as any).name ? (user as any).name : "Sem nome"}</p>
      <p>Email: {user.email}</p>
      <p>Role: {(user as ExtendedUser).role || "Não definido"}</p>
    </div>
  );
};

export default TestAuth;