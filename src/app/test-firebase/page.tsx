"use client";

import React, { useEffect } from "react";
import { auth } from "@/lib/firebase";

const TestFirebase: React.FC = () => {
  useEffect(() => {
    // Verifica se a configuração do Firebase foi corretamente inicializada.
    console.log("Objeto auth do Firebase:", auth);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-center text-2xl font-bold">
        Firebase está configurado corretamente!
      </h1>
    </div>
  );
};

export default TestFirebase;