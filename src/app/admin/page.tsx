import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminPromotionPanel from "./AdminPromotionPanel";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <AdminPromotionPanel />
      </main>
      <Footer />
    </div>
  );
}
