'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import useAuth from '@/hooks/useAuth';

const AdminMain: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redireciona caso o usuário não seja admin
  useEffect(() => {
    if (!loading && user?.role !== 'admin') {
      router.push('/'); // Redireciona para a home ou outra rota adequada.
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="py-8">
        <div className="max-w-4xl mx-auto bg-gray-900 p-8 rounded shadow">
          <h1 className="text-3xl font-bold text-center mb-6">Painel Administrativo</h1>

          {/* Botões de navegação principais */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <Link
              href="/admin/promotion"
              className="w-full md:w-1/2 text-center py-3 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Gestão de Usuários
            </Link>
            <Link
              href="/admin/dashboard"
              className="w-full md:w-1/2 text-center py-3 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-600 transition"
            >
              Agenda dos Barbeiros
            </Link>
            <Link
              href="/admin/servicos"
              className="w-full md:w-1/2 text-center py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Cadastro de Serviços
            </Link>
          </div>

          {/* Cards para novas funcionalidades */}
          <h2 className="text-xl font-bold mb-4">Gerenciamento de Horários</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded shadow">
              <h3 className="text-xl font-bold mb-2">Horários Globais</h3>
              <p className="text-gray-300 mb-4">
                Configure os horários padrão de funcionamento e exceções globais.
              </p>
              <Link
                href="/admin/operating"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded inline-block"
              >
                Configurar
              </Link>
            </div>

            <div className="bg-gray-800 p-6 rounded shadow">
              <h3 className="text-xl font-bold mb-2">Horários por Barbeiro</h3>
              <p className="text-gray-300 mb-4">
                Configure horários específicos e exceções para cada barbeiro.
              </p>
              <Link
                href="/admin/barbeirosConfig"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded inline-block"
              >
                Configurar
              </Link>
            </div>

            <div className="bg-gray-800 p-6 rounded shadow">
              <h3 className="text-xl font-bold mb-2">Migração de Dados</h3>
              <p className="text-gray-300 mb-4">
                Migre dados da estrutura antiga para a nova estrutura.
              </p>
              <Link
                href="/admin/migration"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded inline-block"
              >
                Gerenciar Migração
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AdminMain;
