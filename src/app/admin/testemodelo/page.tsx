"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { useBarbeiros } from '@/hooks/useBarbeiros';
import { useServicos } from '@/hooks/useServicos';
import { useOperatingHours } from '@/hooks/useOperatingHours';
import { useAgendamentos } from '@/hooks/useAgendamentos';

// Componente específico para testar horários
const HorariosTest = ({ barbeiroId, onResult }: { barbeiroId: string, onResult: (result: string) => void }) => {
  const { operatingHours, exceptions, loading } = useOperatingHours(barbeiroId);
  
  useEffect(() => {
    if (!loading) {
      if (operatingHours) {
        onResult(`Horários do barbeiro carregados com sucesso! Dias configurados: ${Object.keys(operatingHours).filter(day => operatingHours[day as keyof typeof operatingHours]?.active).length}`);
      } else {
        onResult('Não foi possível carregar os horários do barbeiro');
      }
    }
  }, [operatingHours, loading, onResult]);
  
  return null;
};

// Componente específico para testar agendamentos
const AgendamentosTest = ({ onResult }: { onResult: (result: string) => void }) => {
  const { agendamentos, loading } = useAgendamentos();
  
  useEffect(() => {
    // Adicionamos um console.log para depuração
    console.log("AgendamentosTest:", { loading, agendamentos });
    
    if (loading) {
      onResult('Carregando agendamentos...');
    } else {
      if (agendamentos && agendamentos.length > 0) {
        onResult(`Agendamentos carregados com sucesso! Total: ${agendamentos.length}`);
      } else {
        onResult('Nenhum agendamento encontrado');
      }
    }
  }, [loading, agendamentos, onResult]);
  
  // Precisamos manter o componente montado até que o carregamento seja concluído
  return null;
};

const TesteModeloPage: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { barbeiros, loading: barbeirosLoading } = useBarbeiros();
  const { servicos, loading: servicosLoading } = useServicos();
  const { operatingHours, exceptions, loading: hoursLoading } = useOperatingHours();
  
  // Estado para armazenar os resultados dos testes
  const [resultado, setResultado] = useState<string>('');
  const [selectedBarbeiroId, setSelectedBarbeiroId] = useState<string>('');
  
  // Estado para controlar a exibição dos componentes de teste
  const [showHorariosTest, setShowHorariosTest] = useState(false);
  const [showAgendamentosTest, setShowAgendamentosTest] = useState(false);
  
  // Função para testar acesso a barbeiros
  const testarAcessoBarbeiros = () => {
    if (barbeiros.length > 0) {
      setResultado(`Barbeiros carregados com sucesso! Total: ${barbeiros.length}`);
      // Selecionar automaticamente o primeiro barbeiro para facilitar os testes
      if (barbeiros[0]?.id) {
        setSelectedBarbeiroId(barbeiros[0].id);
      }
    } else {
      setResultado('Nenhum barbeiro encontrado');
    }
  };
  
  // Função para testar acesso a serviços
  const testarAcessoServicos = () => {
    if (servicos.length > 0) {
      setResultado(`Serviços carregados com sucesso! Total: ${servicos.length}`);
    } else {
      setResultado('Nenhum serviço encontrado');
    }
  };
  
  // Função para testar acesso a horários de barbeiro
  const testarAcessoHorarios = () => {
    if (!selectedBarbeiroId) {
      setResultado('Por favor, selecione um barbeiro primeiro');
      return;
    }
    
    setResultado('Carregando horários...');
    // Mostrar o componente HorariosTest que vai fazer o teste do hook
    setShowHorariosTest(true);
  };
  
  // Função para testar acesso a agendamentos
  const testarAcessoAgendamentos = () => {
    setResultado('Carregando agendamentos...');
    // Mostrar o componente AgendamentosTest que vai fazer o teste do hook
    setShowAgendamentosTest(true);
    
    // Não vamos esconder o componente automaticamente
    // O componente se encarregará de atualizar o resultado
  };
  
  // Resetar os testes quando mudar de barbeiro
  useEffect(() => {
    setShowHorariosTest(false);
    setShowAgendamentosTest(false);
  }, [selectedBarbeiroId]);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Teste do Novo Modelo de Dados</h1>
      
      {authLoading ? (
        <p>Carregando autenticação...</p>
      ) : user ? (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Status dos Dados</h2>
            <ul className="mb-6 space-y-2">
              <li>Barbeiros: {barbeirosLoading ? "Carregando..." : `${barbeiros.length} carregados`}</li>
              <li>Serviços: {servicosLoading ? "Carregando..." : `${servicos.length} carregados`}</li>
              <li>Horários Globais: {hoursLoading ? "Carregando..." : operatingHours ? "Carregados" : "Não disponíveis"}</li>
            </ul>
            
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={testarAcessoBarbeiros}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Testar Acesso a Barbeiros
              </button>
              
              <button
                onClick={testarAcessoServicos}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Testar Acesso a Serviços
              </button>
              
              {selectedBarbeiroId && (
                <button
                  onClick={testarAcessoHorarios}
                  className="bg-purple-500 text-white px-4 py-2 rounded"
                >
                  Testar Horários do Barbeiro
                </button>
              )}
              
              <button
                onClick={testarAcessoAgendamentos}
                className="bg-orange-500 text-white px-4 py-2 rounded"
              >
                Testar Acesso a Agendamentos
              </button>
            </div>
            
            {selectedBarbeiroId && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Barbeiro Selecionado</h3>
                <p>{barbeiros.find(b => b.id === selectedBarbeiroId)?.name || selectedBarbeiroId}</p>
              </div>
            )}
            
            {resultado && (
              <div className="p-4 bg-gray-100 rounded border mb-6">
                <h3 className="text-lg font-semibold mb-2">Resultado:</h3>
                <p>{resultado}</p>
              </div>
            )}
            
            {barbeiros.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Selecionar Barbeiro para Testes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {barbeiros.map((barbeiro) => (
                    <div
                      key={barbeiro.id}
                      onClick={() => setSelectedBarbeiroId(barbeiro.id)}
                      className={`p-4 rounded border cursor-pointer ${
                        selectedBarbeiroId === barbeiro.id ? 'bg-blue-100 border-blue-500' : 'bg-white'
                      }`}
                    >
                      <h4 className="font-medium">{barbeiro.name}</h4>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Renderizar os componentes de teste quando solicitado */}
          {showHorariosTest && selectedBarbeiroId && (
            <HorariosTest 
              barbeiroId={selectedBarbeiroId} 
              onResult={(res) => {
                setResultado(res);
                setShowHorariosTest(false);
              }}
            />
          )}
          
          {showAgendamentosTest && (
            <AgendamentosTest 
              onResult={(res) => {
                setResultado(res);
                // Aguardamos um pouco antes de esconder o componente
                setTimeout(() => setShowAgendamentosTest(false), 500);
              }}
            />
          )}
        </>
      ) : (
        <p>Você precisa estar autenticado para acessar esta página.</p>
      )}
    </div>
  );
};

export default TesteModeloPage;