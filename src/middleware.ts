import { NextRequest, NextResponse } from "next/server";

// Middleware leve — auth e subscription são verificados client-side
// (Supabase JS client usa localStorage, não cookies, então não dá pra checar auth aqui)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Root "/" now shows the landing page — no redirect needed

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)",
  ],
};
