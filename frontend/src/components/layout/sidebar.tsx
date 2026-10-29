import { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Users,
  UtensilsCrossed,
  Sparkles,
  Receipt,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  TreePine,
  ClipboardCheck,
  BookOpen,
  Phone,
  Menu,
  X,
  Handshake,
  Gift,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/bookings', label: 'Bookings', icon: BookOpen },
  { path: '/enquiries', label: 'Enquiry', icon: Phone },
  { path: '/leads', label: 'Leads', icon: Target, adminOnly: true },
  { path: '/events', label: 'Events', icon: Gift, adminOnly: true },
  { path: '/partners', label: 'Partners', icon: Handshake, adminOnly: true },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/rooms', label: 'Rooms', icon: BedDouble },
  { path: '/guests', label: 'Guests', icon: Users },
  { path: '/restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { path: '/housekeeping', label: 'Housekeeping', icon: ClipboardCheck },
  { path: '/activities', label: 'Activities', icon: Sparkles },
  { path: '/billing', label: 'Billing', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN'
  );

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <TreePine className="h-5 w-5" strokeWidth={1.75} />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-ink">SriNamo Farms</span>
            <span className="text-xs text-muted">Resort PMS</span>
          </div>
        )}
      </div>

      <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {filteredItems.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-glass',
                isActive ? 'bg-accent text-accent-foreground' : 'text-ink hover:bg-background/70'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="hidden border-t border-line p-3 lg:block">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden w-full items-center justify-center rounded-xl p-2 text-muted hover:bg-background hover:text-ink lg:flex"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="glass-strong fixed left-3 top-3 z-40 rounded-xl p-2 text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="glass-strong fixed bottom-0 left-0 top-0 w-72">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside
        className={cn(
          'glass-strong hidden shrink-0 lg:flex lg:flex-col',
          collapsed ? 'w-[76px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
