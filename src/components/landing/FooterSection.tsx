import BrandLogo from "@/components/landing/BrandLogo";

export default function FooterSection() {
  return (
    <footer className="border-t border-white/[0.06] px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <BrandLogo />
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Sistema para infoprodutores que querem captar, vender e se relacionar com mais controle.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-300 md:items-end">
          <div className="flex flex-wrap gap-4">
            <a href="#como-funciona" className="transition-colors hover:text-white">
              Como funciona
            </a>
            <a href="#modulos" className="transition-colors hover:text-white">
              Modulos
            </a>
            <a href="#planos" className="transition-colors hover:text-white">
              Planos
            </a>
            <a href="#faq" className="transition-colors hover:text-white">
              FAQ
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Flow Up. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
