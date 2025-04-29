import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminDashboard from "./AdminDashboard";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <AdminDashboard />
      </main>
      <Footer />
    </div>
  );
}
