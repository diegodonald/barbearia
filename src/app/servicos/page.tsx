'use client';

import { useState, useEffect } from 'react';
import Footer from '@/components/Footer';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Define a estrutura de um serviço cadastrado
interface Service {
  id?: string;
  name: string;
  duration: string;
  value: number;
}

export default function Servicos() {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState<boolean>(true);

  useEffect(() => {
    async function fetchServices() {
      try {
        const querySnapshot = await getDocs(collection(db, 'servicos'));
        const list: Service[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Service[];
        setServices(list);
      } catch (error) {
        console.error('Erro ao buscar serviços:', error);
      } finally {
        setLoadingServices(false);
      }
    }
    fetchServices();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="py-20 px-4">
        <h1 className="text-center text-5xl font-extrabold mb-10">Serviços</h1>
        <div className="max-w-3xl mx-auto">
          {loadingServices ? (
            <p className="text-xl">Carregando serviços...</p>
          ) : services.length === 0 ? (
            <p className="text-xl">Nenhum serviço cadastrado.</p>
          ) : (
            <ul className="space-y-4 text-xl">
              {services.map(service => (
                <li
                  key={service.id}
                  className="flex justify-between items-center border-b border-gray-700 py-2"
                >
                  <span>{service.name}</span>
                  <span>R$ {Number(service.value).toFixed(2).replace('.', ',')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
