// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

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
const analytics = getAnalytics(app);

// Inicializa os serviços que serão usados no projeto
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Caso precise utilizar o app em outras partes, exporte também
export default app;
