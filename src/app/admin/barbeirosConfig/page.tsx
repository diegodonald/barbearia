'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import BarbeirosConfig from './BarbeirosConfig';
import useAuth from '@/hooks/useAuth';

const Page: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Se não estiver carregando e o usuário não for admin nem barber, redireciona para o login.
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'barber'))) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="py-20 px-4">
        <BarbeirosConfig />
      </main>
      <Footer />
    </div>
  );
};

export default Page;
