import { useState } from 'react';
import { Bell, LogOut, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getInitials, roleLabel } from '@/lib/utils';
import ThemeToggle from './theme-toggle';
import { useSearchGuests } from '@/hooks/useGuests';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const [query, setQuery] = useState('');
  const { data: guests } = useSearchGuests(query.trim());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="glass-strong flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
      <h1 className="hidden min-w-0 truncate text-lg font-semibold text-ink sm:block">{title}</h1>
      <div className="relative ml-10 min-w-0 flex-1 sm:ml-0 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guests"
          aria-label="Search guests"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 z-30 max-h-64 overflow-auto rounded-xl border border-line bg-surface shadow-lg">
            {(guests ?? []).length === 0 && <p className="px-3 py-2 text-sm text-muted">No guests</p>}
            {(guests ?? []).map((guest) => (
              <button
                key={guest.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-background"
                onClick={() => {
                  setQuery('');
                  navigate(`/guests/${guest.id}`);
                }}
              >
                {guest.firstName} {guest.lastName}
                <span className="ml-2 text-muted">{guest.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Notifications" className="rounded-xl p-2 text-ink hover:bg-background">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <p className="px-2 py-2 text-sm text-ink">No notifications</p>
          <p className="px-2 pb-2 text-xs text-muted">WhatsApp messages are queued from a booking or guest.</p>
        </DropdownMenuContent>
      </DropdownMenu>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full" aria-label="Account menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-tint text-xs text-accent">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <Badge variant="secondary" className="mt-1">{roleLabel(user.role)}</Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-danger">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
