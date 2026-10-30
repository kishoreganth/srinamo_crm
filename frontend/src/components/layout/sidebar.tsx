import { useEffect, useRef, useState } from 'react';
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
  ChefHat,
  Menu,
  X,
  Handshake,
  Gift,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  { path: '/restaurant/kitchen', label: 'Kitchen', icon: ChefHat },
  { path: '/housekeeping', label: 'Housekeeping', icon: ClipboardCheck },
  { path: '/activities', label: 'Activities', icon: Sparkles },
  { path: '/billing', label: 'Billing', icon: Receipt },
  { path: '/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

interface SidebarProps {
  currentPath: string;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const toggleCollapsed = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setLabelsOn(collapsed);
      setCollapsed(!collapsed);
      return;
    }
    if (!collapsed) {
      setLabelsOn(false);
      timer.current = window.setTimeout(() => setCollapsed(true), 120);
      return;
    }
    setCollapsed(false);
    timer.current = window.setTimeout(() => setLabelsOn(true), 20);
  };

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN'
  );

  const panel = (compact: boolean, fadeLabels: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <TreePine className="h-5 w-5" strokeWidth={1.75} />
        </div>
        {!compact && (
          <div className={cn('flex min-w-0 flex-col transition-opacity duration-motion-1 ease-motion-out', fadeLabels && !labelsOn ? 'opacity-0' : 'opacity-100')}>
            <span className="truncate text-sm font-semibold text-ink">SriNamo Farms</span>
            <span className="text-xs text-muted">Resort PMS</span>
          </div>
        )}
      </div>

      <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {filteredItems.map((item) => {
          const matches = currentPath === item.path || currentPath.startsWith(item.path + '/');
          const isActive = matches && !filteredItems.some(
            (other) => other.path.length > item.path.length && (currentPath === other.path || currentPath.startsWith(other.path + '/'))
          );
          const Icon = item.icon;
          const button = (
            <button
              type="button"
              onClick={() => handleNav(item.path)}
              aria-label={compact ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'motion-press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                isActive ? 'bg-accent text-accent-foreground' : 'text-ink hover:bg-background/70'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              {!compact && (
                <span className={cn('truncate transition-opacity duration-motion-1 ease-motion-out', fadeLabels && !labelsOn ? 'opacity-0' : 'opacity-100')}>
                  {item.label}
                </span>
              )}
            </button>
          );
          if (!compact) return <div key={item.path} className="contents">{button}</div>;
          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="glass-strong motion-press fixed left-3 top-3 z-40 rounded-xl p-2 text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="motion-overlay-in fixed inset-0 bg-black/40 backdrop-blur-[6px]" onClick={() => setMobileOpen(false)} />
          <div className="glass-strong motion-drawer fixed bottom-0 left-0 top-0 w-72">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
            {panel(false, false)}
          </div>
        </div>
      )}

      <aside
        className={cn(
          'glass-strong hidden shrink-0 lg:flex lg:flex-col',
          collapsed ? 'w-[76px]' : 'w-64'
        )}
      >
        {panel(collapsed, true)}
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="motion-press flex w-full items-center justify-center rounded-xl p-2 text-muted hover:bg-background hover:text-ink"
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
