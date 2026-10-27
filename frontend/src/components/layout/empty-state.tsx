import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon className="h-10 w-10 text-gold" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-base font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass flex flex-col items-center px-6 py-12 text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-danger" strokeWidth={1.75} />
      <p className="mt-3 text-sm text-ink">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 text-sm font-medium text-accent">
          Try again
        </button>
      )}
    </div>
  );
}
