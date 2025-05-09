import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import ClientHeader from '@/components/ClientHeader';

// Usar a fonte Inter como alternativa mais estável
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Barbearia',
  description: 'Sistema de agendamento para barbearia',
};

// TypeScript declaration for custom window properties
declare global {
  interface Window {
    debugAuth: () => Promise<{ user: any }>;
    forceLogout: () => Promise<void>;
  }
}

// Debug helper
if (typeof window !== 'undefined') {
  window.debugAuth = async () => {
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    console.log('Current user:', user);

    if (user) {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      console.log('User data:', userDoc.exists() ? userDoc.data() : null);
    }

    return { user };
  };

  window.forceLogout = async () => {
    const { auth } = await import('@/lib/firebase');
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    console.log('Logout forçado');
    window.location.reload();
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <ClientHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
