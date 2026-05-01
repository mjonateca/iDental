"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Calendar, LayoutDashboard, LogOut, Scissors, Settings, UserRound, Users } from "lucide-react";
import LogoMark from "@/components/branding/logo-mark";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AccountRole } from "@/types/database";

type NavItem = {
  tab: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const shopNavItems: NavItem[] = [
  { tab: "summary", label: "Resumen", icon: LayoutDashboard },
  { tab: "bookings", label: "Reservas", icon: Calendar },
  { tab: "services", label: "Servicios", icon: Scissors },
  { tab: "barbers", label: "Dentistas", icon: UserRound },
  { tab: "clients", label: "Clientes", icon: Users },
  { tab: "schedule", label: "Horarios", icon: Calendar },
  { tab: "email", label: "Emails", icon: Bell },
  { tab: "settings", label: "Ajustes", icon: Settings },
];

const clientNavItems: NavItem[] = [
  { tab: "summary", label: "Cerca de mí", icon: LayoutDashboard },
  { tab: "bookings", label: "Reservas", icon: Calendar },
  { tab: "favorites", label: "Favoritos", icon: Bell },
  { tab: "profile", label: "Perfil", icon: UserRound },
];

const barberNavItems: NavItem[] = [
  { tab: "summary", label: "Hoy", icon: LayoutDashboard },
  { tab: "bookings", label: "Turnos", icon: Calendar },
  { tab: "clients", label: "Clientes", icon: Users },
  { tab: "profile", label: "Perfil", icon: UserRound },
];

function tabHref(tab: string) {
  return `/dashboard?tab=${tab}`;
}

export default function DashboardNav({ role = "shop_owner" }: { role?: AccountRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const navItems = role === "client" ? clientNavItems : role === "barber" ? barberNavItems : shopNavItems;
  const activeTab = searchParams.get("tab") || "summary";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <aside className="fixed left-0 top-0 hidden h-full w-72 flex-col border-r border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,250,255,0.96))] backdrop-blur md:flex">
        <div className="border-b border-sky-100 p-6">
          <Link href={tabHref("summary")} className="flex items-center gap-2">
            <div className="rounded-2xl bg-primary p-2.5 text-white shadow-sm">
              <LogoMark className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-lg font-bold">iDental</span>
              <span className="block text-xs text-muted-foreground">Control operativo</span>
            </div>
          </Link>
        </div>

        <div className="mx-4 mt-4 rounded-2xl border border-sky-100 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Navegacion</p>
          <p className="mt-1 text-sm text-muted-foreground">Clinica, agenda, equipo y caja en un solo lugar.</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.tab}
              href={tabHref(item.tab)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                pathname === "/dashboard" && activeTab === item.tab
                  ? "bg-[linear-gradient(135deg,hsl(var(--primary)),#8fd7ff)] text-white shadow-[0_12px_30px_rgba(91,181,244,0.28)]"
                  : "text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sky-100 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sky-100 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <Link
              key={item.tab}
              href={tabHref(item.tab)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium transition-colors",
                pathname === "/dashboard" && activeTab === item.tab ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", pathname === "/dashboard" && activeTab === item.tab && "text-primary")} />
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <LogOut className="h-5 w-5" />
            Salir
          </button>
        </div>
      </nav>
    </>
  );
}
