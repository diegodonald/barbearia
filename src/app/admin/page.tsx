"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const AdminMain: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <div className="py-8">
        <div className="max-w-4xl mx-auto bg-gray-900 p-8 rounded shadow">
          <h1 className="text-3xl font-bold text-center mb-6">
            Painel Administrativo
          </h1>
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/admin/promotion"
              className="w-full md:w-1/2 text-center py-3 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Promover Usuários
            </Link>
            <Link
              href="/admin/dashboard"
              className="w-full md:w-1/2 text-center py-3 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-600 transition"
            >
              Agenda dos Barbeiros
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AdminMain;
