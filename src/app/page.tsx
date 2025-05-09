import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Seção Hero */}
      <main className="flex flex-col items-center justify-center py-20 px-4">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold mb-4">
            Diego´s Barber – Cortes Perfeitos, Sempre!
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
      <section className="location-section py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Mapa */}
          <div className="w-full md:w-1/2">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.123456789012!2d-49.1234567!3d-25.1234567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x123456789abcdef!2sRua+Paulo+Celso+Winkler%2C+236+-+Passo+Dos+Fortes!5e0!3m2!1spt-BR!2sbr!4v1234567890123"
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
            ></iframe>
          </div>

          {/* Informações da barbearia */}
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold mb-6">Localização e Horário</h2>
            <p className="mb-2">Diego's Barber</p>
            <p className="mb-2">Rua Paulo Celso Winkler, 236 - Passo Dos Fortes</p>
            <p className="mb-2">(49) 98908-1347</p>
            <p className="mb-4">diegodonald@gmail.com</p>
            <a
              href="https://www.google.com/maps?q=Rua+Paulo+Celso+Winkler,+236+-+Passo+Dos+Fortes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Obter Direções
            </a>
            <p>Agendamento fácil, não perca tempo na fila!</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
