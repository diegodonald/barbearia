import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BarbeiroDashboard from "./BarbeiroDashboard";

export default function BarbeiroDashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <BarbeiroDashboard />
      </main>
      <Footer />
    </div>
  );
}
