'use client';

import Footer from '@/components/Footer';
import AdminDashboard from './AdminDashboard';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="py-20 px-4">
        <button
          onClick={() => router.back()}
          className="mb-4 bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
        >
          Voltar
        </button>
        <AdminDashboard />
      </main>
      <Footer />
    </div>
  );
}
