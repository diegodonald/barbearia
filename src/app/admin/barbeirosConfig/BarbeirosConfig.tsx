'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import 'react-datepicker/dist/react-datepicker.css';

// Atualização da interface para incluir os novos campos de intervalo
interface DayConfig {
  open?: string;
  breakStart?: string;
  breakEnd?: string;
  close?: string;
  active: boolean;
}

export interface BarberConfig {
  // A estrutura é definida sob a chave "horarios"
  horarios: {
    segunda: DayConfig;
    terça: DayConfig;
    quarta: DayConfig;
    quinta: DayConfig;
    sexta: DayConfig;
    sábado: DayConfig;
    domingo: DayConfig;
  };
  exceptions?: Exception[];
}

interface Exception {
  id?: string;
  date: string; // Formato "YYYY-MM-DD"
  status: 'blocked' | 'available';
  message?: string;
  open?: string;
  close?: string;
}

interface BarberOption {
  id: string;
  name: string;
}

const BarbeirosConfig: React.FC = () => {
  const router = useRouter();

  // Estado para a lista de barbeiros
  const [barberOptions, setBarberOptions] = useState<BarberOption[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [barberConfig, setBarberConfig] = useState<BarberConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  // Estado para nova exceção (estrutura inalterada)
  const [newException, setNewException] = useState<Exception>({
    date: '',
    status: 'blocked',
    message: '',
    open: '',
    close: '',
  });

  // Carrega a lista de barbeiros com role "barber"
  useEffect(() => {
    async function fetchBarbers() {
      try {
        const q = await getDocs(collection(db, 'usuarios'));
        const barbers = q.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
          .filter(user => user.role === 'barber')
          .map(user => ({ id: user.id, name: user.name }));
        setBarberOptions(barbers);
      } catch (error) {
        console.error('Erro ao buscar barbeiros:', error);
      }
    }
    fetchBarbers();
  }, []);

  // Modificação no useEffect que carrega os dados do barbeiro
  useEffect(() => {
    if (!selectedBarberId) return;
    setLoading(true);

    // 1. Carregar os horários da coleção horarios/{barberId}
    const horarioDocRef = doc(db, 'horarios', selectedBarberId);

    // 2. Carregar as exceções da subcoleção excecoes/{barberId}/datas
    const excecoesDatasRef = collection(db, 'excecoes', selectedBarberId, 'datas');

    Promise.all([getDoc(horarioDocRef), getDocs(excecoesDatasRef)])
      .then(([horariosSnapshot, excecoesSnapshot]) => {
        // Processar os horários
        const horarios = horariosSnapshot.exists()
          ? (horariosSnapshot.data() as BarberConfig['horarios'])
          : createDefaultSchedule();

        // Processar as exceções
        const exceptions = excecoesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Exception[];

        // Configurar o estado
        setBarberConfig({
          horarios: horarios,
          exceptions: exceptions,
        });
      })
      .catch(error => {
        console.error('Erro ao carregar configurações:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedBarberId]);

  // Adicione esta função auxiliar fora do componente:
  function createDefaultSchedule() {
    return {
      segunda: {
        open: '08:00',
        breakStart: '12:00',
        breakEnd: '13:30',
        close: '17:30',
        active: true,
      },
      terça: {
        open: '08:00',
        breakStart: '12:00',
        breakEnd: '13:30',
        close: '17:30',
        active: true,
      },
      quarta: {
        open: '08:00',
        breakStart: '12:00',
        breakEnd: '13:30',
        close: '17:30',
        active: true,
      },
      quinta: {
        open: '08:00',
        breakStart: '12:00',
        breakEnd: '13:30',
        close: '17:30',
        active: true,
      },
      sexta: {
        open: '08:00',
        breakStart: '12:00',
        breakEnd: '13:30',
        close: '17:30',
        active: true,
      },
      sábado: {
        open: '08:00',
        breakStart: '12:00',
        breakEnd: '13:30',
        close: '14:00',
        active: true,
      },
      domingo: { active: false },
    };
  }

  // Modificação na função saveConfig para usar a estrutura correta de coleções
  const saveConfig = async () => {
    if (!selectedBarberId || !barberConfig) return;
    try {
      // 1. Salvar os horários na coleção horarios/{barberId}
      const horarioDocRef = doc(db, 'horarios', selectedBarberId);
      await setDoc(horarioDocRef, barberConfig.horarios, { merge: true });

      // 2. Salvar as exceções na subcoleção excecoes/{barberId}/datas
      if (barberConfig.exceptions && barberConfig.exceptions.length > 0) {
        // Primeiro, remover exceções existentes
        const excecoesDatasRef = collection(db, 'excecoes', selectedBarberId, 'datas');
        const snapshot = await getDocs(excecoesDatasRef);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // Depois, adicionar as novas exceções
        const addPromises = barberConfig.exceptions.map(exception => {
          const docId = exception.date; // Usar a data como ID do documento
          return setDoc(doc(db, 'excecoes', selectedBarberId, 'datas', docId), exception);
        });
        await Promise.all(addPromises);
      }

      setFeedback('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setFeedback('Erro ao salvar configurações. Tente novamente.');
    }
  };

  // Função para adicionar uma exceção
  const handleAddException = () => {
    if (!newException.date) {
      setFeedback('Informe uma data para a exceção.');
      return;
    }
    if (newException.status === 'available' && (!newException.open || !newException.close)) {
      setFeedback('Para liberar um dia inativo, informe os horários de abertura e fechamento.');
      return;
    }
    if (barberConfig) {
      const updatedExceptions = barberConfig.exceptions
        ? [...barberConfig.exceptions, newException]
        : [newException];
      setBarberConfig({ ...barberConfig, exceptions: updatedExceptions });
      setNewException({ date: '', status: 'blocked', message: '', open: '', close: '' });
      setFeedback('');
    }
  };

  // Função para remover uma exceção pelo índice
  const handleRemoveException = (index: number) => {
    if (barberConfig && barberConfig.exceptions) {
      const updatedList = barberConfig.exceptions.filter((_, i) => i !== index);
      setBarberConfig({ ...barberConfig, exceptions: updatedList });
    }
  };

  // Renderiza o formulário para cada dia, exibindo os 4 campos de horário
  const renderDayForm = (day: keyof BarberConfig['horarios']) => {
    if (!barberConfig) return null;
    const config = barberConfig.horarios[day];
    return (
      <div key={day} className="mb-4 p-4 border rounded bg-gray-800">
        <h3 className="text-lg capitalize mb-2">{day}</h3>
        <div className="flex items-center mb-2">
          <label className="mr-2">Ativo?</label>
          <input
            type="checkbox"
            checked={config.active}
            onChange={e =>
              setBarberConfig({
                ...barberConfig,
                horarios: {
                  ...barberConfig.horarios,
                  [day]: { ...config, active: e.target.checked },
                },
              })
            }
          />
        </div>
        {config.active && (
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block">Horário de Abertura:</label>
              <input
                type="time"
                value={config.open || ''}
                onChange={e =>
                  setBarberConfig({
                    ...barberConfig,
                    horarios: {
                      ...barberConfig.horarios,
                      [day]: { ...config, open: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label className="block">Início do Intervalo:</label>
              <input
                type="time"
                value={config.breakStart || ''}
                onChange={e =>
                  setBarberConfig({
                    ...barberConfig,
                    horarios: {
                      ...barberConfig.horarios,
                      [day]: { ...config, breakStart: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label className="block">Término do Intervalo:</label>
              <input
                type="time"
                value={config.breakEnd || ''}
                onChange={e =>
                  setBarberConfig({
                    ...barberConfig,
                    horarios: {
                      ...barberConfig.horarios,
                      [day]: { ...config, breakEnd: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
            <div>
              <label className="block">Horário de Fechamento:</label>
              <input
                type="time"
                value={config.close || ''}
                onChange={e =>
                  setBarberConfig({
                    ...barberConfig,
                    horarios: {
                      ...barberConfig.horarios,
                      [day]: { ...config, close: e.target.value },
                    },
                  })
                }
                className="px-2 py-1 bg-gray-700 text-white rounded"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Botão Voltar */}
      <div className="px-4 pt-6 flex justify-start">
        <button
          onClick={() => router.push('/admin')}
          className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600 transition text-white"
        >
          Voltar
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6">Configuração Individual do Barbeiro</h1>

      {/* Seletor de Barbeiro */}
      <div className="mb-6">
        <label className="block mb-1">Selecione o Barbeiro:</label>
        <select
          value={selectedBarberId}
          onChange={e => {
            setSelectedBarberId(e.target.value);
            setFeedback('');
          }}
          className="px-3 py-2 bg-gray-200 text-black rounded"
        >
          <option value="">Selecione um barbeiro</option>
          {barberOptions.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Carregando configuração...</p>
      ) : barberConfig ? (
        <>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Horários Semanais</h2>
            {(Object.keys(barberConfig.horarios) as (keyof BarberConfig['horarios'])[]).map(day =>
              renderDayForm(day)
            )}
          </section>

          {/* Seção de Exceções */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Exceções</h2>
            {/* Formulário para Adicionar Exceção */}
            <div className="mb-4 p-4 border rounded bg-gray-800">
              <div className="flex flex-wrap gap-4 items-center mb-2">
                <label className="block">Data:</label>
                <input
                  type="date"
                  value={newException.date}
                  onChange={e => setNewException({ ...newException, date: e.target.value })}
                  className="px-2 py-1 text-black rounded"
                />
              </div>
              <div className="flex flex-wrap gap-4 items-center mb-2">
                <label className="block">Status:</label>
                <select
                  value={newException.status}
                  onChange={e =>
                    setNewException({
                      ...newException,
                      status: e.target.value as 'blocked' | 'available',
                    })
                  }
                  className="px-2 py-1 text-black rounded"
                >
                  <option value="blocked">Bloqueado</option>
                  <option value="available">Liberado</option>
                </select>
              </div>
              {newException.status === 'available' && (
                <div className="flex flex-wrap gap-4 items-center mb-2">
                  <div>
                    <label className="block">Abertura:</label>
                    <input
                      type="time"
                      value={newException.open || ''}
                      onChange={e => setNewException({ ...newException, open: e.target.value })}
                      className="px-2 py-1 text-black rounded"
                    />
                  </div>
                  <div>
                    <label className="block">Fechamento:</label>
                    <input
                      type="time"
                      value={newException.close || ''}
                      onChange={e => setNewException({ ...newException, close: e.target.value })}
                      className="px-2 py-1 text-black rounded"
                    />
                  </div>
                </div>
              )}
              <div className="mb-2">
                <label className="block">Mensagem (opcional):</label>
                <input
                  type="text"
                  value={newException.message}
                  onChange={e => setNewException({ ...newException, message: e.target.value })}
                  className="w-full px-2 py-1 text-black rounded"
                />
              </div>
              <button
                onClick={handleAddException}
                className="bg-green-500 px-4 py-2 rounded hover:bg-green-600 transition"
              >
                Adicionar Exceção
              </button>
            </div>
            {/* Listagem das Exceções Existentes */}
            <section>
              <h3 className="text-xl font-semibold mb-2">Exceções Existentes:</h3>
              {barberConfig.exceptions && barberConfig.exceptions.length > 0 ? (
                <ul className="space-y-2">
                  {barberConfig.exceptions.map((ex, index) => (
                    <li
                      key={index}
                      className="flex justify-between items-center bg-gray-700 p-2 rounded"
                    >
                      <span>
                        {ex.date} – {ex.status}{' '}
                        {ex.status === 'available' && ex.open && ex.close
                          ? `(Abertura: ${ex.open}, Fechamento: ${ex.close})`
                          : ''}
                        {ex.message ? ` - ${ex.message}` : ''}
                      </span>
                      <button
                        onClick={() => handleRemoveException(index)}
                        className="bg-red-500 px-2 py-1 rounded hover:bg-red-600 transition"
                      >
                        Excluir
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhuma exceção cadastrada.</p>
              )}
            </section>
          </section>

          <button
            onClick={saveConfig}
            className="mt-6 bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Salvar Configuração
          </button>
          {feedback && <p className="mt-4 text-center text-green-500">{feedback}</p>}
        </>
      ) : (
        <p>Nenhuma configuração encontrada para este barbeiro.</p>
      )}
    </div>
  );
};

const _getGlobalHorarios = () => {
  /* função */
};

export default BarbeirosConfig;
