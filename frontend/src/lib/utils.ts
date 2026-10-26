import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      colors: [
        'ink', 'muted', 'surface', 'background', 'foreground', 'accent', 'danger', 'success', 'warning', 'gold', 'tint', 'line',
        'status-available', 'status-available-fg', 'status-occupied', 'status-occupied-fg',
        'status-cleaning', 'status-cleaning-fg', 'status-maintenance', 'status-maintenance-fg',
        'status-inspected', 'status-inspected-fg', 'status-neutral', 'status-neutral-fg',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function roleLabel(role?: string) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'RECEPTIONIST') return 'Receptionist';
  return role ?? '';
}

const available = 'bg-status-available text-status-available-fg';
const occupied = 'bg-status-occupied text-status-occupied-fg';
const cleaning = 'bg-status-cleaning text-status-cleaning-fg';
const maintenance = 'bg-status-maintenance text-status-maintenance-fg';
const inspected = 'bg-status-inspected text-status-inspected-fg';
const neutral = 'bg-status-neutral text-status-neutral-fg';

const statusPairs: Record<string, string> = {
  AVAILABLE: available,
  CONFIRMED: available,
  PAID: available,
  READY: available,
  SERVED: available,
  COMPLETED: available,
  OCCUPIED: occupied,
  CHECKED_IN: occupied,
  IN_PROGRESS: occupied,
  CLEANING: cleaning,
  PENDING: cleaning,
  PLACED: cleaning,
  PREPARING: cleaning,
  PARTIAL: cleaning,
  HOLD: cleaning,
  MAINTENANCE: maintenance,
  CANCELLED: maintenance,
  UNPAID: maintenance,
  INSPECTED: inspected,
  CHECKED_OUT: neutral,
  NO_SHOW: neutral,
};

export function getStatusColor(status: string): string {
  return statusPairs[status] ?? neutral;
}

export function getStatusDot(status: string): string {
  const pair = getStatusColor(status);
  return pair.split(' ').find((token) => token.startsWith('bg-')) ?? 'bg-status-neutral';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getDaysBetween(start: string | Date, end: string | Date): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}
