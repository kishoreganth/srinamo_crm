import { prefersReducedMotion } from './reduced';

export function Ticker({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  if (prefersReducedMotion()) {
    return <p className="truncate text-sm text-muted">{items.join(' · ')}</p>;
  }
  const line = items.join('    ·    ');
  return (
    <div className="motion-ticker overflow-hidden rounded-xl border border-line bg-glass px-3 py-2">
      <div className="motion-ticker-track">
        <span className="text-sm text-ink">{line}</span>
        <span className="text-sm text-ink" aria-hidden>{line}</span>
      </div>
    </div>
  );
}
