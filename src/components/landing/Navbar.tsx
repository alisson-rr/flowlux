"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/landing/BrandLogo";

const links = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#modulos", label: "Modulos" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-[#05070D]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 py-4">
        <a href="#top" className="shrink-0">
          <BrandLogo />
        </a>

        <div className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#planos"
            className="hidden rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-300/20 hover:text-white sm:inline-flex"
          >
            Ver planos
          </a>
          <Link href="/login">
            <Button variant="hero" size="sm" className="landing-button-primary text-white">
              Testar gratis por 7 dias
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
