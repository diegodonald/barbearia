import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <Header />

      {/* Seção Hero */}
      <main className="flex flex-col items-center justify-center py-20 px-4">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold mb-4">
            |Diego´s Barber – Cortes Perfeitos, Sempre!
          </h1>
          <p className="text-xl mb-8">
            Desconto de R$5 para estudantes! Somente de segunda a quinta!
          </p>
          <a
            href="/agendamento"
            className="bg-yellow-500 text-black font-semibold px-6 py-3 rounded hover:bg-yellow-600 transition cursor-pointer"
          >
            Reservar Agora
          </a>
        </div>
      </main>

      {/* Seção "Localização e Horário" */}
      <section className="bg-gray-900 text-white py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Localização e Horário</h2>
          <p className="mb-2">
            <strong>Diego´s Barber</strong>
          </p>
          <p className="mb-2">Rua Nirvana, 236, Passo Dos Fortes</p>
          <p className="mb-2">(49) 98908 1347</p>
          <p className="mb-2">diegodonald@gmail.com</p>
          <a
            href="https://goo.gl/maps/..."
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-500 underline"
          >
            Obter Direções
          </a>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
