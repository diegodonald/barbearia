"use client";

import React, { useEffect } from "react";
import { auth, db, analytics } from "@/lib/firebase";

const TestExport: React.FC = () => {
  useEffect(() => {
    // Fazer log dos objetos para ver se estão sendo exportados corretamente
    console.log("Firebase Auth object:", auth);
    console.log("Firestore instance (db):", db);
    console.log("Firebase Analytics object (if available):", analytics);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-center">Teste de Exportação dos Serviços</h1>
      <p className="text-center mt-4">
        Verifique o console do navegador para ver os objetos do Firebase.
      </p>
    </div>
  );
};

export default TestExport;