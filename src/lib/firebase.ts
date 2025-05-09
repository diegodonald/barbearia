import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDS7NABLzgLwRM5GEEqPt8HQs5SdxrbLKk',
  authDomain: 'barbearia-270425.firebaseapp.com',
  projectId: 'barbearia-270425',
  storageBucket: 'barbearia-270425.firebasestorage.app',
  messagingSenderId: '640549323701',
  appId: '1:640549323701:web:767d80fc97c9f34ce7cffc',
  measurementId: 'G-4YXRFCJY50',
};

// Inicializa o Firebase apenas no lado do cliente e apenas uma vez
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Analytics apenas no cliente
let analytics = null;

// Configurar persistência da autenticação
if (typeof window !== 'undefined') {
  // Código que só executa no navegador
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Persistência de autenticação configurada');
    })
    .catch(error => {
      console.error('Erro ao configurar persistência:', error);
    });

  // Inicializar analytics apenas no cliente
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('Analytics inicializado.');
    }
  });
}

export { app, auth, db, analytics };
export default app;
