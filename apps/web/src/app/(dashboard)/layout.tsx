'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/agents', label: 'Agents', icon: Bot, badge: null },
  { href: '/leads', label: 'Leads', icon: Users, badge: null },
  { href: '/deals', label: 'Deals', icon: Handshake, badge: null },
  { href: '/projects', label: 'Projects', icon: FolderKanban, badge: null },
  { href: '/hitl', label: 'Approvals', icon: ShieldCheck, badge: '3' },
];

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20 border border-primary/30">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
          AgentePro
        </span>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <item.icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <Badge variant="default" className="h-5 min-w-5 text-[10px] font-semibold bg-primary/80 hover:bg-primary/80">
                    {item.badge}
                  </Badge>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/60" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="px-3 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
        >
          <Settings className="w-4.5 h-4.5" />
          Settings
        </Link>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, operatorEmail, logout } = useAuthStore();
  const [darkMode, setDarkMode] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials = mounted && operatorEmail
    ? operatorEmail.substring(0, 2).toUpperCase()
    : 'OP';

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SidebarContent pathname={pathname} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-4 lg:px-6 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <h1 className="text-sm font-semibold text-foreground capitalize">
              {pathname.split('/')[1] || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="text-muted-foreground hover:text-foreground">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground truncate">{operatorEmail}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
