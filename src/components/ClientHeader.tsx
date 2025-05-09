'use client';

import dynamic from 'next/dynamic';

// Importação dinâmica do Header sem SSR
const Header = dynamic(() => import('@/components/Header'), { ssr: false });

export default function ClientHeader() {
  return <Header />;
}
