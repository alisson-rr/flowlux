import Link from "next/link";
import BrandLogo from "@/components/landing/BrandLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flowup-auth min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-5 md:px-6 md:py-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <BrandLogo className="gap-2.5" iconClassName="h-10 w-10 rounded-xl" />
          </Link>

          <Link href="/" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
            Voltar
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-8 md:py-10">
          <div className="w-full max-w-md md:max-w-lg">{children}</div>
        </main>
      </div>
    </div>
  );
}
