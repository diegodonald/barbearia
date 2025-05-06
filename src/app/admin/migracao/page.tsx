"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuth from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const MigracaoPage: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [step, setStep] = useState<number>(1);

  // Verificar se o usuário é admin
  if (!loading && (!user || user.role !== "admin")) {
    router.push("/");
    return null;
  }

  const criarNovasColecoesVazias = async () => {
    try {
      setProgress("Criando coleções vazias...");
      setError("");
      
      // Criar um documento inicial em cada coleção
      await setDoc(doc(db, "barbeiros", "initial"), {
        createdAt: new Date(),
        _temp: true
      });
      
      await setDoc(doc(db, "horarios", "initial"), {
        createdAt: new Date(),
        _temp: true
      });
      
      await setDoc(doc(db, "excecoes", "initial"), {
        createdAt: new Date(),
        _temp: true
      });
      
      await setDoc(doc(db, "excecoes/initial/datas", "initial"), {
        createdAt: new Date(),
        _temp: true
      });
      
      // Limpar os documentos temporários
      await deleteDoc(doc(db, "barbeiros", "initial"));
      await deleteDoc(doc(db, "horarios", "initial"));
      await deleteDoc(doc(db, "excecoes", "initial"));
      await deleteDoc(doc(db, "excecoes/initial/datas", "initial"));
      
      setProgress("Coleções vazias criadas com sucesso!");
      setStep(2);
    } catch (error: any) {
      console.error("Erro ao criar coleções:", error);
      setError(`Erro ao criar coleções: ${error.message || "Erro desconhecido"}`);
    }
  };

  const migrarBarbeiros = async () => {
    try {
      setProgress("Migrando barbeiros...");
      setError("");
      
      const userSnapshot = await getDocs(query(
        collection(db, "usuarios"),
        where("role", "==", "barber")
      ));
      
      if (userSnapshot.empty) {
        setProgress("Nenhum barbeiro encontrado para migrar.");
        setStep(3);
        return;
      }
      
      let count = 0;
      for (const barberDoc of userSnapshot.docs) {
        const barberData = barberDoc.data();
        
        // Criar documento na coleção "barbeiros"
        await setDoc(doc(db, "barbeiros", barberDoc.id), {
          userId: barberDoc.id,
          name: barberData.name || "Barbeiro",
          active: true,
          createdAt: barberData.createdAt || new Date()
        });
        
        // Migrar horários se existirem
        if (barberData.horarios) {
          await setDoc(doc(db, "horarios", barberDoc.id), barberData.horarios);
        }
        
        // Migrar exceções se existirem
        if (barberData.exceptions && barberData.exceptions.length > 0) {
          for (const exception of barberData.exceptions) {
            if (exception.date) {
              await setDoc(doc(db, "excecoes", barberDoc.id, "datas", exception.date), {
                ...exception,
                createdAt: new Date()
              });
            }
          }
        }
        
        count++;
      }
      
      setProgress(`${count} barbeiros migrados com sucesso!`);
      setStep(3);
    } catch (error: any) {
      console.error("Erro ao migrar barbeiros:", error);
      setError(`Erro ao migrar barbeiros: ${error.message || "Erro desconhecido"}`);
    }
  };

  const migrarConfiguracoes = async () => {
    try {
      setProgress("Migrando configurações globais...");
      setError("");
      
      // Buscar configurações globais
      const configSnapshot = await getDocs(collection(db, "configuracoes"));
      
      if (configSnapshot.empty) {
        setProgress("Nenhuma configuração encontrada para migrar.");
        setStep(4);
        return;
      }
      
      for (const configDoc of configSnapshot.docs) {
        const configData = configDoc.data();
        
        // Migrar configurações de horário
        if (configDoc.id === "operatingHours" && configData.horarios) {
          await setDoc(doc(db, "configuracoes", "horarios"), configData.horarios);
          setProgress("Horários globais migrados com sucesso.");
        }
        
        // Migrar exceções globais
        if (configData.exceptions && Array.isArray(configData.exceptions)) {
          for (const exception of configData.exceptions) {
            if (exception.date) {
              await setDoc(
                doc(db, "configuracoes", "excecoes", "datas", exception.date),
                {
                  ...exception,
                  createdAt: new Date()
                }
              );
            }
          }
          setProgress("Exceções globais migradas com sucesso.");
        }
      }
      
      setStep(4);
    } catch (error: any) {
      console.error("Erro ao migrar configurações:", error);
      setError(`Erro ao migrar configurações: ${error.message || "Erro desconhecido"}`);
    }
  };

  const finalizarMigracao = async () => {
    try {
      setProgress("Finalizando migração...");
      setError("");
      
      // Criar documento de controle para indicar que a migração foi concluída
      await setDoc(doc(db, "configuracoes", "migracaoStatus"), {
        completed: true,
        completedAt: new Date(),
        version: "1.0.0"
      });
      
      setProgress("Migração concluída com sucesso!");
      setSuccess(true);
    } catch (error: any) {
      console.error("Erro ao finalizar migração:", error);
      setError(`Erro ao finalizar migração: ${error.message || "Erro desconhecido"}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Migração de Dados</h1>
        
        <div className="max-w-3xl mx-auto bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Status da Migração</h2>
          
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${step > 1 || success ? "bg-green-500" : "bg-blue-500"}`}>
                1
              </div>
              <span className="font-medium">Criar novas coleções</span>
            </div>
            
            <div className="flex items-center mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${step > 2 || success ? "bg-green-500" : step === 2 ? "bg-blue-500" : "bg-gray-700"}`}>
                2
              </div>
              <span className="font-medium">Migrar barbeiros</span>
            </div>
            
            <div className="flex items-center mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${step > 3 || success ? "bg-green-500" : step === 3 ? "bg-blue-500" : "bg-gray-700"}`}>
                3
              </div>
              <span className="font-medium">Migrar configurações</span>
            </div>
            
            <div className="flex items-center mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${success ? "bg-green-500" : step === 4 ? "bg-blue-500" : "bg-gray-700"}`}>
                4
              </div>
              <span className="font-medium">Finalizar migração</span>
            </div>
          </div>
          
          {progress && (
            <div className="mb-6 p-4 bg-blue-900 rounded">
              <h3 className="font-bold mb-2">Progresso:</h3>
              <p>{progress}</p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-900 rounded">
              <h3 className="font-bold mb-2">Erro:</h3>
              <p>{error}</p>
            </div>
          )}
          
          <div className="flex justify-center">
            {step === 1 && (
              <button 
                onClick={criarNovasColecoesVazias}
                className="bg-blue-500 px-6 py-3 rounded font-bold hover:bg-blue-600 transition"
                disabled={success}
              >
                Iniciar Migração
              </button>
            )}
            
            {step === 2 && (
              <button 
                onClick={migrarBarbeiros}
                className="bg-blue-500 px-6 py-3 rounded font-bold hover:bg-blue-600 transition"
                disabled={success}
              >
                Migrar Barbeiros
              </button>
            )}
            
            {step === 3 && (
              <button 
                onClick={migrarConfiguracoes}
                className="bg-blue-500 px-6 py-3 rounded font-bold hover:bg-blue-600 transition"
                disabled={success}
              >
                Migrar Configurações
              </button>
            )}
            
            {step === 4 && (
              <button 
                onClick={finalizarMigracao}
                className="bg-blue-500 px-6 py-3 rounded font-bold hover:bg-blue-600 transition"
                disabled={success}
              >
                Finalizar Migração
              </button>
            )}
            
            {success && (
              <button 
                onClick={() => router.push('/admin')}
                className="bg-green-500 px-6 py-3 rounded font-bold hover:bg-green-600 transition"
              >
                Voltar para o Painel
              </button>
            )}
          </div>
          
          {success && (
            <div className="mt-6 p-4 bg-green-900 rounded">
              <h3 className="font-bold mb-2">Migração Concluída!</h3>
              <p>A migração foi concluída com sucesso. O sistema está pronto para utilizar a nova estrutura de dados.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MigracaoPage;