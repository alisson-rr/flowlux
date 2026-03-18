"use client";

const FooterSection = () => {
  return (
    <footer className="border-t border-foreground/5 py-12 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-lg font-bold text-foreground">
          Flow<span className="text-primary">Lux</span>
        </span>
        <p className="text-sm text-muted-foreground">
          Plataforma de atendimento e automação para vendas no WhatsApp.
        </p>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} FlowLux. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
};

export default FooterSection;
