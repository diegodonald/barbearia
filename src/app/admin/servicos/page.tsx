'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import useAuth from '@/hooks/useAuth';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Interface para os serviços armazenados (valor numérico)
interface Service {
  id?: string;
  name: string;
  duration: string; // duração em minutos (entrada: string)
  value: number; // valor armazenado com duas casas decimais
}

// Interface para a entrada do novo serviço (valor em string para não exibir 0 inicialmente)
interface ServiceInput {
  name: string;
  duration: string;
  value: string;
}

export default function AdminServicosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Proteção de rota: se o usuário não for admin, redireciona para home
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Estado para armazenar a lista de serviços e os dados do novo serviço a ser inserido
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState<ServiceInput>({
    name: '',
    duration: '',
    value: '',
  });

  // Estado para controlar o serviço que está sendo editado (caso haja edição)
  const [editingService, setEditingService] = useState<(ServiceInput & { id: string }) | null>(
    null
  );

  // Busca os serviços cadastrados na coleção "servicos"
  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'servicos'));
      const list: Service[] = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Service[];
      setServices(list);
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
    }
  };

  useEffect(() => {
    if (!loading && user && user.role === 'admin') {
      fetchServices();
    }
  }, [loading, user]);

  // Adiciona um novo serviço
  const handleAddService = async () => {
    if (
      !newService.name.trim() ||
      !newService.duration.trim() ||
      !newService.value.trim() ||
      parseFloat(newService.value) <= 0
    ) {
      alert('Preencha todos os campos com valores válidos.');
      return;
    }
    try {
      const numericValue = parseFloat(parseFloat(newService.value).toFixed(2));
      await addDoc(collection(db, 'servicos'), {
        name: newService.name,
        duration: newService.duration,
        value: numericValue,
      });
      setNewService({ name: '', duration: '', value: '' });
      fetchServices();
    } catch (error) {
      console.error('Erro ao adicionar serviço:', error);
    }
  };

  // Deleta um serviço
  const handleDeleteService = async (id: string | undefined) => {
    if (!id) return;
    if (!confirm('Deseja realmente deletar esse serviço?')) return;
    try {
      await deleteDoc(doc(db, 'servicos', id));
      fetchServices();
    } catch (error) {
      console.error('Erro ao deletar serviço:', error);
    }
  };

  // Inicia a edição de um serviço preenchendo o estado com seus dados
  const handleStartEditing = (service: Service) => {
    setEditingService({
      id: service.id!,
      name: service.name,
      duration: service.duration,
      value: service.value.toString(),
    });
  };

  // Cancela a edição
  const handleCancelEdit = () => {
    setEditingService(null);
  };

  // Salva as alterações feitas em um serviço
  const handleSaveEdit = async () => {
    if (
      !editingService ||
      !editingService.name.trim() ||
      !editingService.duration.trim() ||
      !editingService.value.trim() ||
      parseFloat(editingService.value) <= 0
    ) {
      alert('Preencha todos os campos com valores válidos.');
      return;
    }
    try {
      const numericValue = parseFloat(parseFloat(editingService.value).toFixed(2));
      await updateDoc(doc(db, 'servicos', editingService.id), {
        name: editingService.name,
        duration: editingService.duration,
        value: numericValue,
      });
      setEditingService(null);
      fetchServices();
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="py-20 px-4">
        {/* Botão de voltar para /admin */}
        <button
          onClick={() => router.push('/admin')}
          className="mb-4 bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
        >
          Voltar
        </button>
        <h1 className="text-3xl font-bold mb-6">Gestão de Serviços</h1>

        {/* Formulário para adicionar novo serviço */}
        <div className="mb-8 bg-gray-900 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Adicionar Novo Serviço</h2>
          <input
            type="text"
            placeholder="Nome do Serviço"
            value={newService.name}
            onChange={e => setNewService({ ...newService, name: e.target.value })}
            className="bg-gray-800 border border-gray-600 px-4 py-2 rounded mb-2 w-full"
          />
          <input
            type="text"
            placeholder="Duração em minutos"
            value={newService.duration}
            onChange={e => setNewService({ ...newService, duration: e.target.value })}
            className="bg-gray-800 border border-gray-600 px-4 py-2 rounded mb-2 w-full"
          />
          <input
            type="number"
            placeholder="Valor"
            value={newService.value}
            onChange={e => setNewService({ ...newService, value: e.target.value })}
            className="bg-gray-800 border border-gray-600 px-4 py-2 rounded mb-2 w-full"
          />
          <button
            onClick={handleAddService}
            className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Adicionar Serviço
          </button>
        </div>

        {/* Listagem dos serviços cadastrados */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Serviços Cadastrados</h2>
          {services.length === 0 ? (
            <p>Nenhum serviço cadastrado.</p>
          ) : (
            <ul className="space-y-4">
              {services.map(service => (
                <li key={service.id} className="bg-gray-800 p-4 rounded shadow">
                  {editingService && editingService.id === service.id ? (
                    <div>
                      <input
                        type="text"
                        value={editingService.name}
                        onChange={e =>
                          setEditingService({
                            ...editingService,
                            name: e.target.value,
                          })
                        }
                        className="bg-gray-700 border border-gray-600 px-4 py-2 rounded mb-2 w-full"
                      />
                      <input
                        type="text"
                        placeholder="Duração em minutos"
                        value={editingService.duration}
                        onChange={e =>
                          setEditingService({
                            ...editingService,
                            duration: e.target.value,
                          })
                        }
                        className="bg-gray-700 border border-gray-600 px-4 py-2 rounded mb-2 w-full"
                      />
                      <input
                        type="number"
                        placeholder="Valor"
                        value={editingService.value}
                        onChange={e =>
                          setEditingService({
                            ...editingService,
                            value: e.target.value,
                          })
                        }
                        className="bg-gray-700 border border-gray-600 px-4 py-2 rounded mb-2 w-full"
                      />
                      <div className="flex space-x-4">
                        <button
                          onClick={handleSaveEdit}
                          className="bg-green-500 px-4 py-2 rounded hover:bg-green-600 transition"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xl font-semibold">{service.name}</h3>
                      <p>Duração: {service.duration} min</p>
                      <p>Valor: R$ {Number(service.value).toFixed(2).replace('.', ',')}</p>
                      <div className="flex space-x-4 mt-4">
                        <button
                          onClick={() => handleStartEditing(service)}
                          className="bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
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
