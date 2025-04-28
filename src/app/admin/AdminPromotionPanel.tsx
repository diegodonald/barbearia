"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";

// Define uma interface para os dados do usuário
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const AdminPromotionPanel: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Estado para armazenar a lista de usuários com role "user"
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");

  // Verifica se o usuário logado possui role "admin"
  useEffect(() => {
    if (!loading && user) {
      if (user.role !== "admin") {
        router.push("/"); // Redireciona se não for admin
      }
    }
  }, [loading, user, router]);

  // Busca os usuários com role "user"
  useEffect(() => {
    const q = query(collection(db, "usuarios"), where("role", "==", "user"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as User[];
        setUsers(usersData);
        setLoadingUsers(false);
      },
      (error) => {
        console.error("Erro ao buscar usuários:", error);
        setError("Erro ao buscar usuários.");
        setLoadingUsers(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Função para promover um usuário a "barber"
  const promoteUser = async (userId: string) => {
    try {
      const userDocRef = doc(db, "usuarios", userId);
      await updateDoc(userDocRef, { role: "barber" });
      alert("Usuário promovido a Barbeiro com sucesso!");
    } catch (error) {
      console.error("Erro ao promover usuário:", error);
      setError("Erro ao promover usuário.");
    }
  };

  if (loading || loadingUsers) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Painel Administrativo – Promoção de Usuários</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {users.length === 0 ? (
        <p>Nenhum usuário para promover.</p>
      ) : (
        <table className="min-w-full border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Nome</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Ação</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 border">{u.name}</td>
                <td className="px-4 py-2 border">{u.email}</td>
                <td className="px-4 py-2 border">
                  <button
                    onClick={() => {
                      if (window.confirm(`Deseja promover ${u.name} a Barbeiro?`)) {
                        promoteUser(u.id);
                      }
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Promover a Barbeiro
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminPromotionPanel;
