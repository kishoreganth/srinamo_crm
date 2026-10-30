import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '@/stores/theme.store';
import { cn } from '@/lib/utils';

const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

export default function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div className="flex items-center rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Color theme">
      {options.map((option) => {
        const Icon = option.icon;
        const active = mode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => setMode(option.mode)}
            className={cn(
              'motion-press rounded-full p-1.5 text-muted',
              active && 'bg-accent text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
