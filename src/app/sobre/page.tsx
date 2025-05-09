import Footer from '@/components/Footer';

export default function Sobre() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Remova o Header daqui */}

      {/* Conteúdo Principal */}
      <main className="flex flex-col items-center justify-center flex-grow py-20 px-4">
        <h1 className="text-5xl font-extrabold mb-4">Sobre Nós</h1>
        <p className="text-xl text-center">
          Em breve, o dono da barbearia irá incluir informações detalhadas sobre a história, missão
          e valores da Barbearia.
        </p>
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}
