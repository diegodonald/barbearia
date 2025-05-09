/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useAuth from '@/hooks/useAuth';
import { useOperatingHours } from '@/hooks/useOperatingHours';
import { httpsCallable, getFunctions } from 'firebase/functions';

// Define uma interface para os dados do usuário
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// --- Interfaces e Configuração de Agenda ---
// Os dias estão definidos diretamente, sem "diasSemana"
interface DayConfig {
  open?: string;
  close?: string;
  active: boolean;
}

export interface BarberConfig {
  horarios: {
    domingo: DayConfig;
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
  };
  exceptions?: Exception[];
}

interface Exception {
  id?: string;
  date: string;
  status: 'blocked' | 'available';
  message?: string;
  open?: string;
  close?: string;
}

// Fallback fixo – usado se a Agenda Global não estiver disponível
const fallbackConfig: BarberConfig = {
  horarios: {
    segunda: { open: '08:00', close: '18:00', active: true },
    terça: { open: '08:00', close: '18:00', active: true },
    quarta: { open: '08:00', close: '18:00', active: true },
    quinta: { open: '08:00', close: '18:00', active: true },
    sexta: { open: '08:00', close: '18:00', active: true },
    sábado: { open: '09:00', close: '14:00', active: true },
    domingo: { active: false },
  },
  exceptions: [],
};

const AdminPromotionPanel: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Obter dados atuais da Agenda Global
  const { operatingHours } = useOperatingHours();

  // Helper: retorna a configuração global "achatada"
  const getGlobalHorarios = () => {
    return operatingHours || fallbackConfig;
  };

  // Estado para armazenar a lista de usuários
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // Adicione este estado
  const [searchName, setSearchName] = useState('');

  // Filtrar usuários pelo nome
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchName.toLowerCase())
  );

  // Redirecionar se não for administrador
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Carregar lista de usuários
  useEffect(() => {
    if (user && user.role === 'admin') {
      const q = query(collection(db, 'usuarios'));
      const unsubscribe = onSnapshot(
        q,
        querySnapshot => {
          const usersList: User[] = [];
          querySnapshot.forEach(doc => {
            const userData = doc.data();
            usersList.push({
              id: doc.id,
              name: userData.name || 'Sem nome',
              email: userData.email || 'Sem email',
              role: userData.role || 'user',
            });
          });
          setUsers(usersList);
          setLoadingUsers(false);
        },
        error => {
          console.error('Error fetching users:', error);
          setError('Erro ao carregar usuários. Tente novamente mais tarde.');
          setLoadingUsers(false);
        }
      );

      return () => unsubscribe();
    }
  }, [user]);

  // Modificação na função de promoção para usar a estrutura correta
  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      setError('');
      setSuccess('');

      // Atualiza o papel do usuário na coleção usuarios
      const userRef = doc(db, 'usuarios', userId);
      await updateDoc(userRef, {
        role: newRole,
      });

      // Se o usuário for promovido a barbeiro, criar as entradas necessárias
      if (newRole === 'barber') {
        try {
          console.log('Iniciando criação de configurações para novo barbeiro:', userId);

          // 1. Obter informações do usuário
          const userDoc = await getDoc(userRef);
          const userData = userDoc.data();

          // 2. Criar entrada na coleção barbeiros
          console.log('Criando documento na coleção barbeiros');
          const barberRef = doc(db, 'barbeiros', userId);
          await setDoc(barberRef, {
            userId: userId,
            name: userData?.name || 'Sem nome',
            active: true,
          });

          // ... resto do código para criar horários e configurações ...
        } catch (innerError) {
          console.error('Erro ao criar configurações do barbeiro:', innerError);
          // Continuar mesmo com erro, pois o papel já foi atualizado
        }
      }
      // Se o usuário for rebaixado DE barbeiro PARA outro papel
      else if (newRole !== 'barber') {
        try {
          // Verificar se existe um documento na coleção barbeiros
          const barberRef = doc(db, 'barbeiros', userId);
          const barberDoc = await getDoc(barberRef);

          // Se existir, remover
          if (barberDoc.exists()) {
            console.log('Removendo documento da coleção barbeiros:', userId);
            await deleteDoc(barberRef);

            // Também poderia remover os documentos relacionados em horarios e exceções
            const horariosRef = doc(db, 'horarios', userId);
            await deleteDoc(horariosRef);

            // Para a coleção de exceções, precisamos verificar se existe
            // antes de tentar excluir, pois ela pode estar vazia
            // Esta parte é opcional, você pode decidir manter os dados para histórico
            try {
              const excecoesRef = collection(db, 'excecoes', userId, 'datas');
              const excecoesSnap = await getDocs(excecoesRef);

              // Excluir cada documento de exceção
              const exclusoes = excecoesSnap.docs.map(doc => deleteDoc(doc.ref));

              await Promise.all(exclusoes);
            } catch (err) {
              console.log('Nenhuma exceção encontrada ou erro ao excluir:', err);
            }
          }
        } catch (innerError) {
          console.error('Erro ao remover barbeiro:', innerError);
        }
      }

      setSuccess('Papel do usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating user role:', error);
      setError(
        `Erro ao atualizar papel do usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  };

  // Função para excluir um usuário
  const deleteUserAccount = async (userId: string, userName: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir permanentemente o usuário ${userName}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    try {
      setError('');

      // 1. Excluir documento do usuário no Firestore
      const userDocRef = doc(db, 'usuarios', userId);
      await deleteDoc(userDocRef);

      // 2. Chamar função do Firebase para excluir o usuário da autenticação
      const functions = getFunctions();
      const deleteUserAuth = httpsCallable(functions, 'deleteUserAuth');

      // Adicione logs para ajudar no debugging
      console.log('Chamando deleteUserAuth com UID:', userId);

      const result = await deleteUserAuth({ uid: userId });
      console.log('Resultado da exclusão:', result.data);

      alert(`Usuário ${userName} foi excluído com sucesso.`);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      setError(
        `Erro ao excluir usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  };

  if (loading || (user && user.role !== 'admin')) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gerenciar Usuários</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          className="px-4 py-2 border rounded w-full"
        />
      </div>

      {loadingUsers ? (
        <p>Carregando usuários...</p>
      ) : filteredUsers.length === 0 ? (
        <p>Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border">Nome</th>
                <th className="px-4 py-2 border">Email</th>
                <th className="px-4 py-2 border">Role</th>
                <th className="px-4 py-2 border">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td className="px-4 py-2 border">{u.name}</td>
                  <td className="px-4 py-2 border">{u.email}</td>
                  <td className="px-4 py-2 border">{u.role}</td>
                  <td className="px-4 py-2 border">
                    {u.role === 'user' ? (
                      <>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja promover ${u.name} a Barbeiro?`)) {
                              changeUserRole(u.id, 'barber');
                            }
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mr-2 mb-2"
                        >
                          Promover a Barbeiro
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja promover ${u.name} a Admin?`)) {
                              changeUserRole(u.id, 'admin');
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2 mb-2"
                        >
                          Promover a Admin
                        </button>
                        <button
                          onClick={() => deleteUserAccount(u.id, u.name)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                        >
                          Excluir Usuário
                        </button>
                      </>
                    ) : u.role === 'barber' ? (
                      <>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja rebaixar ${u.name} para Cliente?`)) {
                              changeUserRole(u.id, 'user');
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded mr-2 mb-2"
                        >
                          Rebaixar para Cliente
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja promover ${u.name} a Admin?`)) {
                              changeUserRole(u.id, 'admin');
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2 mb-2"
                        >
                          Promover a Admin
                        </button>
                        <button
                          onClick={() => deleteUserAccount(u.id, u.name)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                        >
                          Excluir Usuário
                        </button>
                      </>
                    ) : u.role === 'admin' ? (
                      <>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja rebaixar ${u.name} para Barbeiro?`)) {
                              changeUserRole(u.id, 'barber');
                            }
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded mr-2"
                        >
                          Rebaixar para Barbeiro
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja rebaixar ${u.name} para Cliente?`)) {
                              changeUserRole(u.id, 'user');
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                        >
                          Rebaixar para Cliente
                        </button>
                      </>
                    ) : (
                      <span>Sem ação</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPromotionPanel;
