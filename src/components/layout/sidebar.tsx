"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Zap,
  Plug,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Rocket,
  FolderOpen,
  Headset,
  Kanban,
  Crown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardData } from "@/contexts/dashboard-context";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Funil", href: "/funil", icon: Kanban },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Automação", href: "/automacao", icon: Zap },
  { label: "Mídia", href: "/midia", icon: FolderOpen },
  { label: "Evolua seu Produto", href: "/evolua", icon: Rocket },
  { label: "Assinatura", href: "/assinatura", icon: Crown },
  { label: "Integrações", href: "/configuracoes", icon: Plug },
];

export function Sidebar({ failedCount = 0 }: { failedCount?: number }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const { user: authUser } = useAuth();
  const dashboardData = useDashboardData();
  const profile = dashboardData?.profile;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-border transition-all duration-300 sticky top-0",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border relative">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">FL</span>
          </div>
          {!collapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap">
              FlowLux
            </span>
          )}
        </Link>
        {/* Collapse Button - Outside Menu */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute -right-3 top-[65px] -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-hover transition-colors z-10",
            collapsed && "right-0"
          )}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="truncate flex-1">{item.label}</span>}
              {!collapsed && item.href === "/automacao" && failedCount > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center shrink-0">{failedCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer - User Profile + Logout */}
      <div className="p-2 border-t border-border space-y-1">
        {/* User Profile */}
        <Link
          href="/perfil"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/perfil"
              ? "bg-primary/15 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
          )}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">{getInitials(profile?.name || authUser?.email || "U")}</span>
            </div>
          )}
          {!collapsed && <span className="truncate">{profile?.name || "Meu Perfil"}</span>}
        </Link>

        <a
          href="https://wa.me/5551994408307?text=Olá! Preciso de suporte com o FlowLux."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-400 hover:bg-sidebar-hover transition-colors w-full"
        >
          <Headset className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Suporte</span>}
        </a>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground transition-colors w-full"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
