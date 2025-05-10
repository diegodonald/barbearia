'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { useOperatingHours } from '@/hooks/useOperatingHours';
import { OperatingHours, DayConfig, Exception } from '@/types/schedule';

export default function OperatingHoursPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { operatingHours, exceptions, loading, error, saveOperatingHours, saveException } =
    useOperatingHours('global');

  const [formState, setFormState] = useState<OperatingHours | null>(null);
  const [newException, setNewException] = useState<Exception>({
    date: '',
    status: 'blocked',
    message: '',
  });
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  // Verificação de acesso
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Inicializar o formulário quando os horários forem carregados
  useEffect(() => {
    if (!loading && operatingHours) {
      setFormState(operatingHours);
    } else if (!loading && !operatingHours) {
      // Configuração padrão se não existir
      setFormState({
        domingo: { active: false },
        segunda: {
          active: true,
          open: '08:00',
          close: '18:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
        terça: {
          active: true,
          open: '08:00',
          close: '18:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
        quarta: {
          active: true,
          open: '08:00',
          close: '18:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
        quinta: {
          active: true,
          open: '08:00',
          close: '18:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
        sexta: {
          active: true,
          open: '08:00',
          close: '18:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
        sábado: { active: true, open: '08:00', close: '13:00' },
      });
    }
  }, [loading, operatingHours]);

  // Atualizar um dia específico
  const updateDay = (day: keyof OperatingHours, updates: Partial<DayConfig>) => {
    if (!formState) return;

    setFormState({
      ...formState,
      [day]: { ...formState[day], ...updates },
    });
  };

  // Salvar as configurações
  const saveConfig = async () => {
    if (!formState) return;

    try {
      const success = await saveOperatingHours(formState);

      if (success) {
        setFeedback('Configurações salvas com sucesso!');
        setFeedbackType('success');
        setTimeout(() => setFeedback(''), 3000);
      } else {
        setFeedback('Erro ao salvar configurações.');
        setFeedbackType('error');
      }
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      setFeedback(`Erro ao salvar configurações: ${error.message || 'Desconhecido'}`);
      setFeedbackType('error');
    }
  };

  // Adicionar uma exceção
  const handleAddException = async () => {
    if (!newException.date) {
      setFeedback('Informe uma data para a exceção.');
      setFeedbackType('error');
      return;
    }

    try {
      const success = await saveException(newException);

      if (success) {
        setFeedback('Exceção adicionada com sucesso!');
        setFeedbackType('success');
        setNewException({
          date: '',
          status: 'blocked',
          message: '',
        });
        setTimeout(() => setFeedback(''), 3000);
      } else {
        setFeedback('Erro ao adicionar exceção.');
        setFeedbackType('error');
      }
    } catch (error: any) {
      console.error('Erro ao adicionar exceção:', error);
      setFeedback(`Erro ao adicionar exceção: ${error.message || 'Desconhecido'}`);
      setFeedbackType('error');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!formState && !loading) {
    return (
      <div className="p-6">
        <p className="text-red-500">
          Erro ao carregar configurações: {error || 'Dados não encontrados'}
        </p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        >
          Voltar ao Painel
        </button>
      </div>
    );
  }

  // Renderização do formulário para cada dia da semana
  const renderDayForm = (day: keyof OperatingHours) => {
    if (!formState) return null;
    const config = formState[day];

    return (
      <div key={day} className="mb-4 p-4 border border-gray-700 rounded">
        <h3 className="text-lg capitalize">{day}</h3>
        <div className="mb-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.active}
              onChange={e => updateDay(day, { active: e.target.checked })}
              className="mr-2"
            />
            Ativo
          </label>
        </div>

        {config.active && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block">Abertura:</label>
              <input
                type="time"
                value={config.open || ''}
                onChange={e => updateDay(day, { open: e.target.value })}
                className="border rounded px-2 py-1 bg-gray-700 w-full"
              />
            </div>
            <div>
              <label className="block">Fechamento:</label>
              <input
                type="time"
                value={config.close || ''}
                onChange={e => updateDay(day, { close: e.target.value })}
                className="border rounded px-2 py-1 bg-gray-700 w-full"
              />
            </div>
            <div>
              <label className="block">Início do intervalo:</label>
              <input
                type="time"
                value={config.breakStart || ''}
                onChange={e => updateDay(day, { breakStart: e.target.value })}
                className="border rounded px-2 py-1 bg-gray-700 w-full"
              />
            </div>
            <div>
              <label className="block">Fim do intervalo:</label>
              <input
                type="time"
                value={config.breakEnd || ''}
                onChange={e => updateDay(day, { breakEnd: e.target.value })}
                className="border rounded px-2 py-1 bg-gray-700 w-full"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuração de Horários Globais</h1>

      <div className="mb-8">
        <h2 className="text-xl mb-4">Horários de Funcionamento</h2>
        {formState && Object.keys(formState).map(day => renderDayForm(day as keyof OperatingHours))}
        <button
          onClick={saveConfig}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Salvar Configurações
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-xl mb-4">Exceções (Feriados, Dias Especiais)</h2>

        {/* Formulário para adicionar exceção */}
        <div className="mb-4 p-4 border border-gray-700 rounded">
          <h3 className="text-lg">Nova Exceção</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block">Data:</label>
              <input
                type="date"
                value={newException.date}
                onChange={e => setNewException({ ...newException, date: e.target.value })}
                className="border rounded px-2 py-1 bg-gray-700 w-full"
              />
            </div>
            <div>
              <label className="block">Status:</label>
              <select
                value={newException.status}
                onChange={e =>
                  setNewException({
                    ...newException,
                    status: e.target.value as 'blocked' | 'available',
                  })
                }
                className="border rounded px-2 py-1 bg-gray-700 w-full"
              >
                <option value="blocked">Bloqueado</option>
                <option value="available">Horário especial</option>
              </select>
            </div>

            {newException.status === 'available' && (
              <>
                <div>
                  <label className="block">Abertura:</label>
                  <input
                    type="time"
                    value={newException.open || ''}
                    onChange={e => setNewException({ ...newException, open: e.target.value })}
                    className="border rounded px-2 py-1 bg-gray-700 w-full"
                  />
                </div>
                <div>
                  <label className="block">Fechamento:</label>
                  <input
                    type="time"
                    value={newException.close || ''}
                    onChange={e => setNewException({ ...newException, close: e.target.value })}
                    className="border rounded px-2 py-1 bg-gray-700 w-full"
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block">Mensagem (opcional):</label>
              <input
                type="text"
                value={newException.message || ''}
                onChange={e => setNewException({ ...newException, message: e.target.value })}
                className="border rounded px-2 py-1 bg-gray-700 w-full"
                placeholder="Ex: Feriado de Natal"
              />
            </div>
          </div>
          <button
            onClick={handleAddException}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Adicionar Exceção
          </button>
        </div>

        {/* Lista de exceções */}
        <h3 className="text-lg mb-2">Exceções Existentes</h3>
        {exceptions && exceptions.length > 0 ? (
          <div className="space-y-2">
            {exceptions.map((ex, index) => (
              <div
                key={index}
                className="p-2 border border-gray-700 rounded flex justify-between items-center"
              >
                <div>
                  <span className="font-bold">{ex.date}</span>
                  {ex.message && <span> - {ex.message}</span>}
                  <span className="ml-2">
                    {ex.status === 'blocked' ? '(Bloqueado)' : `(Aberto: ${ex.open} - ${ex.close})`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Nenhuma exceção cadastrada.</p>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 p-2 ${feedbackType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
