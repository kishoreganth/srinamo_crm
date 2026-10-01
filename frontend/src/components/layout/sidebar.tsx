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
  LogOut,
  ChevronLeft,
  ChevronRight,
  TreePine,
  ClipboardCheck,
  BookOpen,
  Menu,
  X,
  Handshake,
  Gift,
  Target,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/bookings', label: 'Bookings', icon: BookOpen },
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
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN'
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
          <TreePine className="h-6 w-6 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold text-white">SriNamo Farms</span>
            <span className="text-xs text-emerald-300">Resort PMS</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 overflow-y-auto scrollbar-thin">
        {filteredItems.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-800 text-white'
                  : 'text-emerald-200 hover:bg-emerald-900 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-emerald-800 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mb-2 hidden w-full items-center justify-center rounded-lg p-2 text-emerald-300 hover:bg-emerald-900 hover:text-white lg:flex"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        {user && (
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-700 text-emerald-100 text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="truncate text-xs text-emerald-300">{user.role}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-900 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-emerald-950 p-2 text-white shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-emerald-950">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-emerald-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside
        className={cn(
          'hidden lg:flex lg:flex-col bg-emerald-950 transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
