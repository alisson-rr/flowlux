import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/cadastro", "/esqueceu-senha"];

// Routes that don't require an active subscription (but require auth)
const NO_SUBSCRIPTION_ROUTES = ["/assinatura", "/assinatura/sucesso", "/assinatura/historico", "/perfil"];

// API routes that should be excluded from middleware
const API_ROUTES = ["/api/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip API routes
  if (API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip public assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check authentication via Supabase cookie
  const accessToken = req.cookies.get("sb-access-token")?.value
    || req.cookies.get(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`)?.value;

  // Try to get the token from the cookie that Supabase JS client sets
  let authToken: string | null = null;
  const allCookies = req.cookies.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token")) {
      try {
        const parsed = JSON.parse(cookie.value);
        if (parsed?.access_token) {
          authToken = parsed.access_token;
        } else if (Array.isArray(parsed) && parsed[0]) {
          authToken = parsed[0];
        }
      } catch {
        authToken = cookie.value;
      }
      break;
    }
  }

  if (!authToken && !accessToken) {
    // Not authenticated, redirect to login
    if (pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // For the root path, redirect to dashboard (login page handles its own redirect)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Check subscription for protected routes
  const needsSubscription = !NO_SUBSCRIPTION_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));

  if (needsSubscription && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get user from the token
      const token = authToken || accessToken || "";
      const { data: { user } } = await supabase.auth.getUser(token);

      if (!user) {
        return NextResponse.redirect(new URL("/login", req.url));
      }

      // Check for active subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id, plan_id, status, trial_end")
        .eq("user_id", user.id)
        .in("status", ["active", "authorized", "trial", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!subscription) {
        // No active subscription, redirect to plans page
        return NextResponse.redirect(new URL("/assinatura", req.url));
      }

      // Check if trial has expired
      if (subscription.status === "trial" && subscription.trial_end) {
        const trialEnd = new Date(subscription.trial_end);
        if (trialEnd < new Date()) {
          // Trial expired, update status and redirect
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("id", subscription.id);
          return NextResponse.redirect(new URL("/assinatura", req.url));
        }
      }

      // Add subscription info to headers for downstream use
      const response = NextResponse.next();
      response.headers.set("x-subscription-plan", subscription.plan_id);
      response.headers.set("x-subscription-status", subscription.status);
      return response;
    } catch (err) {
      // If subscription check fails, allow access (fail open to not block users)
      console.error("Middleware subscription check error:", err);
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};
