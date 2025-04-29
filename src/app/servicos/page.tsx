import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Servicos() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Cabeçalho */}
      <Header />

      {/* Conteúdo Principal */}
      <main className="py-20 px-4">
        <h1 className="text-center text-5xl font-extrabold mb-10">
          Serviços
        </h1>
        <div className="max-w-3xl mx-auto">
          <ul className="space-y-4 text-xl">
            <li className="flex justify-between items-center border-b border-gray-700 py-2">
              <span>Corte</span>
              <span>R$ 40,00</span>
            </li>
            <li className="flex justify-between items-center border-b border-gray-700 py-2">
              <span>Barba</span>
              <span>R$ 50,00</span>
            </li>
            {/* Para futuras adições:
            <li className="flex justify-between items-center border-b border-gray-700 py-2">
              <span>Outro Serviço</span>
              <span>R$ XX,XX</span>
            </li>
            */}
          </ul>
        </div>
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}
