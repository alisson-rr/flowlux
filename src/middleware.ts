import { NextRequest, NextResponse } from "next/server";

// Middleware leve — auth e subscription são verificados client-side
// (Supabase JS client usa localStorage, não cookies, então não dá pra checar auth aqui)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect root to login (page.tsx also does this, but this is faster)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)",
  ],
};
