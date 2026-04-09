"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  FolderOpen,
  Headset,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  MessageSquare,
  PanelsTopLeft,
  Plug,
  Rocket,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardData } from "@/contexts/dashboard-context";
import { isPreCheckoutLabEnabledInBrowser } from "@/lib/feature-access";

const coreNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Funil", href: "/funil", icon: Kanban },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Grupos", href: "/grupos", icon: MessagesSquare },
  { label: "Pop-ups", href: "/capturas", icon: PanelsTopLeft },
  { label: "Automacao", href: "/automacao", icon: Zap },
  { label: "Midia", href: "/midia", icon: FolderOpen },
  { label: "Evolua seu Produto", href: "/evolua", icon: Rocket },
  { label: "Assinatura", href: "/assinatura", icon: Crown },
  { label: "Integracoes", href: "/configuracoes", icon: Plug },
];

export function Sidebar({ failedCount = 0 }: { failedCount?: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [showPreCheckoutLab, setShowPreCheckoutLab] = React.useState(false);
  const { user: authUser } = useAuth();
  const dashboardData = useDashboardData();
  const profile = dashboardData?.profile;

  React.useEffect(() => {
    setShowPreCheckoutLab(isPreCheckoutLabEnabledInBrowser());
  }, []);

  const navItems = React.useMemo(
    () => (showPreCheckoutLab
      ? [...coreNavItems, { label: "Labs: Quiz", href: "/formularios", icon: FileText }]
      : coreNavItems),
    [showPreCheckoutLab],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      <div className="relative flex h-16 items-center border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
            <span className="text-sm font-bold text-white">FL</span>
          </div>
          {!collapsed && (
            <span className="whitespace-nowrap bg-gradient-to-r from-primary to-secondary bg-clip-text text-lg font-bold text-transparent">
              FlowLux
            </span>
          )}
        </Link>

        <button
          onClick={() => setCollapsed((current) => !current)}
          className={cn(
            "absolute top-[65px] z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-hover",
            collapsed ? "right-0" : "-right-3",
          )}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.href === "/automacao" && failedCount > 0 && (
                <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {failedCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-2">
        <Link
          href="/perfil"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/perfil"
              ? "bg-primary/15 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground",
          )}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <span className="text-[10px] font-bold text-primary">
                {getInitials(profile?.name || authUser?.email || "U")}
              </span>
            </div>
          )}
          {!collapsed && <span className="truncate">{profile?.name || "Meu Perfil"}</span>}
        </Link>

        <a
          href="https://wa.me/5551994408307?text=Ola! Preciso de suporte com o FlowLux."
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-green-400 transition-colors hover:bg-sidebar-hover"
        >
          <Headset className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Suporte</span>}
        </a>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
