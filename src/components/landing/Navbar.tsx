"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-foreground/5 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <span className="text-xl font-bold text-foreground">
          Flow<span className="text-primary">Lux</span>
        </span>

        <div className="hidden md:flex items-center gap-8">
          <a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
          <Link href="/login">
            <Button variant="hero" size="sm">Começar agora</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
