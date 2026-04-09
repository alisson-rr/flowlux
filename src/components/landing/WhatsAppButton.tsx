"use client";

import { Phone } from "lucide-react";

export default function WhatsAppButton() {
  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Olá! Gostaria de falar com um especialista sobre o Flow Up.");
    window.open(`https://wa.me/5551994408307?text=${message}`, "_blank");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <div className="relative rounded-2xl border border-cyan-400/25 bg-[#08111F]/92 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="absolute -bottom-2 right-5 h-3.5 w-3.5 rotate-45 border-b border-r border-cyan-400/25 bg-[#08111F]" />
        <p className="text-sm font-medium whitespace-nowrap text-slate-100">Falar com um especialista</p>
      </div>

      <button
        onClick={handleWhatsAppClick}
        className="landing-button-primary relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_20px_45px_rgba(37,99,235,0.3)]"
        aria-label="Falar com um especialista no WhatsApp"
      >
        <Phone className="h-6 w-6" />
      </button>
    </div>
  );
}
