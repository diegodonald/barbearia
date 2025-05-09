/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Desabilitar strict mode pode ajudar com certos problemas de dupla renderização
  experimental: {
    // Opções experimentais que podem ajudar com a estabilidade
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Aumentar o tempo limite para compilação em desenvolvimento
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Aumentar o tempo limite para o webpack no lado do cliente durante o desenvolvimento
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 300,
        poll: 1000,
      };
    }

    // Adicionar esta configuração para resolver problemas de timeout
    if (!isServer) {
      config.externals = {
        ...config.externals,
        bufferutil: 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
      };
    }

    return config;
  },
};

module.exports = nextConfig;
