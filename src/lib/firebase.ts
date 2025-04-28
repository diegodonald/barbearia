// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDS7NABLzgLwRM5GEEqPt8HQs5SdxrbLKk",
  authDomain: "barbearia-270425.firebaseapp.com",
  projectId: "barbearia-270425",
  storageBucket: "barbearia-270425.firebasestorage.app",
  messagingSenderId: "640549323701",
  appId: "1:640549323701:web:767d80fc97c9f34ce7cffc",
  measurementId: "G-4YXRFCJY50"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa os serviços principais
export const auth = getAuth(app);
export const db = getFirestore(app);

// Inicializa o Analytics somente no navegador com importação dinâmica
let analytics: any = null;

if (typeof window !== "undefined") {
  import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) => {
      return isSupported().then((supported: boolean) => {
        if (supported) {
          try {
            analytics = getAnalytics(app);
            console.log("Firebase Analytics inicializado.");
          } catch (error) {
            console.error("Erro ao inicializar o Firebase Analytics:", error);
          }
        } else {
          console.log("Firebase Analytics não é suportado neste ambiente.");
        }
      });
    })
    .catch((err) => {
      console.error("Erro ao carregar o módulo firebase/analytics:", err);
    });
}

export { analytics };
export default app;