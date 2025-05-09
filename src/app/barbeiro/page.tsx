import Footer from '@/components/Footer';
import BarbeiroDashboard from './BarbeiroDashboard';

export default function BarbeiroDashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="py-20 px-4">
        <BarbeiroDashboard />
      </main>
      <Footer />
    </div>
  );
}
