"use client";

import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BarbeirosConfig from "./BarbeirosConfig";

const Page: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <BarbeirosConfig />
      </main>
      <Footer />
    </div>
  );
};

export default Page;