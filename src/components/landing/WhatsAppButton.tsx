"use client";

import { Phone } from "lucide-react";

export default function WhatsAppButton() {
  const handleWhatsAppClick = () => {
    const message = encodeURIComponent("Olá! Gostaria de falar com um especialista sobre o FlowLux.");
    window.open(`https://wa.me/5551994408307?text=${message}`, "_blank");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Balão */}
      <div
        className="
          relative bg-green-500 text-white px-4 py-3 rounded-2xl shadow-lg
        "
      >
        <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-8 border-l-transparent border-t-8 border-t-green-500 border-r-8 border-r-transparent"></div>
        <p className="text-sm font-medium whitespace-nowrap">
          Falar com um especialista
        </p>
      </div>

      {/* Botão do WhatsApp */}
      <button
        onClick={handleWhatsAppClick}
        className="
          relative bg-green-500 hover:bg-green-600 text-white
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
        "
        aria-label="Falar com um especialista no WhatsApp"
      >
        <Phone className="w-6 h-6" />
      </button>
    </div>
  );
}
