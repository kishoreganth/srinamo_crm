import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-100 text-emerald-800',
    CONFIRMED: 'bg-emerald-100 text-emerald-800',
    OCCUPIED: 'bg-blue-100 text-blue-800',
    CHECKED_IN: 'bg-blue-100 text-blue-800',
    MAINTENANCE: 'bg-red-100 text-red-800',
    CLEANING: 'bg-yellow-100 text-yellow-800',
    INSPECTED: 'bg-purple-100 text-purple-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    NO_SHOW: 'bg-gray-100 text-gray-800',
    CHECKED_OUT: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-orange-100 text-orange-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    PLACED: 'bg-orange-100 text-orange-800',
    PREPARING: 'bg-yellow-100 text-yellow-800',
    READY: 'bg-emerald-100 text-emerald-800',
    SERVED: 'bg-green-100 text-green-800',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800';
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
