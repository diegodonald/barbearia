import Footer from '@/components/Footer';

export default function Blog() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Remova o Header daqui */}

      {/* Conteúdo Principal */}
      <main className="flex flex-col items-center justify-center flex-grow py-20 px-4">
        <h1 className="text-5xl font-extrabold mb-4">Blog</h1>
        <p className="text-xl text-center">
          Em breve, o dono da barbearia incluirá fotos, vídeos e outras novidades aqui.
        </p>
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}
