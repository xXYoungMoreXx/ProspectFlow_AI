"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useHitlStore } from "@/lib/stores/hitl-store";
import { useLeadsStore } from "@/lib/stores/leads-store";
import { useAgentsStore } from "@/lib/stores/agents-store";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations, useLocale } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bot,
  Users,
  Handshake,
  FolderKanban,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  Monitor,
  DollarSign,
  FileText,
  Search,
  Globe,
  Check,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/agents", labelKey: "nav.agents", icon: Bot },
  { href: "/leads", labelKey: "nav.leads", icon: Users },
  { href: "/deals", labelKey: "nav.deals", icon: Handshake },
  { href: "/projects", labelKey: "nav.projects", icon: FolderKanban },
  { href: "/briefings", labelKey: "nav.briefings", icon: FileText },
  { href: "/prospecting", labelKey: "nav.prospecting", icon: Search },
  { href: "/hitl", labelKey: "nav.hitl", icon: ShieldCheck },
  { href: "/costs", labelKey: "nav.costs", icon: DollarSign },
] as const;

const LOCALE_CODE: Record<string, string> = {
  "pt-BR": "PT",
  es: "ES",
  en: "EN",
};

function SidebarContent({
  pathname,
  labels,
}: {
  pathname: string;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20 border border-primary/30">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
          AgentePro
        </span>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-[120ms] ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
                )}
                <item.icon
                  className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"}`}
                />
                <span className="flex-1">
                  {labels[item.labelKey] ?? item.labelKey}
                </span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator className="bg-sidebar-border" />
      <div className="px-3 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="w-4 h-4" />
          {labels["nav.settings"]}
        </Link>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, operatorEmail, logout, setAuth } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const currentLocale = useLocale();
  const { fetchPending } = useHitlStore();
  const { fetchLeads } = useLeadsStore();
  const { fetchAgents } = useAgentsStore();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isAuthenticated) return;

    // In dev mode: auto-login via the /api/v1/auth/dev-login endpoint so
    // users who git-clone and run locally never see the login screen.
    if (process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN === "true") {
      api.auth
        .devLogin(
          process.env.NEXT_PUBLIC_DEV_AUTO_EMAIL ?? "admin@agentepro.dev",
          process.env.NEXT_PUBLIC_DEV_AUTO_PASSWORD ?? "admin123",
        )
        .then((res) => {
          setAuth(
            res.data.accessToken,
            res.data.refreshToken,
            process.env.NEXT_PUBLIC_DEV_AUTO_EMAIL ?? "admin@agentepro.dev",
          );
        })
        .catch(() => router.push("/login"));
    } else {
      router.push("/login");
    }
  }, [mounted, isAuthenticated, router, setAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      const ev = new EventSource("/api/events");
      ev.addEventListener("heartbeat", () => {
        fetchPending();
        fetchLeads();
        fetchAgents();
      });
      return () => ev.close();
    }
  }, [isAuthenticated, fetchPending, fetchLeads, fetchAgents]);

  const handleLocaleChange = async (locale: string) => {
    await setLocale(locale);
    router.refresh();
  };

  const navLabels = {
    "nav.agents": t("nav.agents"),
    "nav.leads": t("nav.leads"),
    "nav.deals": t("nav.deals"),
    "nav.projects": t("nav.projects"),
    "nav.briefings": t("nav.briefings"),
    "nav.prospecting": t("nav.prospecting"),
    "nav.hitl": t("nav.hitl"),
    "nav.costs": t("nav.costs"),
    "nav.settings": t("nav.settings"),
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };
  const initials =
    mounted && operatorEmail
      ? operatorEmail.substring(0, 2).toUpperCase()
      : "OP";

  // Gate only on `mounted` (avoids SSR/hydration flash). Do NOT also gate on
  // `isAuthenticated`: a transient false→true flip (e.g. a background 401 from
  // a heartbeat poll triggering silent-refresh-then-relogin) would unmount
  // `children` and wipe any in-progress page state (open forms, uploads).
  // The redirect effect above already routes genuinely unauthenticated users
  // to /login; stores guard their fetches on token presence, so a brief
  // unauthenticated render here shows no protected data.
  if (!mounted) return null;

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex lg:w-56 lg:flex-col bg-sidebar shadow-sm">
        <SidebarContent pathname={pathname} labels={navLabels} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-56 p-0 bg-sidebar border-sidebar-border"
        >
          <SidebarContent pathname={pathname} labels={navLabels} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between h-14 px-4 lg:px-6 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setMobileOpen(true)}
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                }
              />
            </Sheet>
            <h1 className="text-sm font-semibold text-foreground capitalize">
              {pathname.split("/")[1] || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Language selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">
                      {LOCALE_CODE[currentLocale] ?? "PT"}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-40">
                {(["pt-BR", "es", "en"] as const).map((loc) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => void handleLocaleChange(loc)}
                  >
                    <span className="flex-1">{t(`language.${loc}`)}</span>
                    {currentLocale === loc && (
                      <Check className="w-3.5 h-3.5 ml-2 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ThemeIcon className="w-4 h-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="w-4 h-4 mr-2" />
                  {t("theme.light")}
                  {theme === "light" && (
                    <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="w-4 h-4 mr-2" />
                  {t("theme.dark")}
                  {theme === "dark" && (
                    <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Monitor className="w-4 h-4 mr-2" />
                  {t("theme.system")}
                  {theme === "system" && (
                    <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {operatorEmail}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
