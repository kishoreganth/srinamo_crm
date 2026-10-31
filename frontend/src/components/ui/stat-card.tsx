import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { CountUp } from '@/components/motion/count-up';

interface StatCardProps {
  label: string;
  value?: ReactNode;
  count?: number;
  format?: (n: number) => string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ label, value, count, format, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="text-2xl font-bold text-ink">
            {count === undefined ? value : <CountUp value={count} format={format} />}
          </p>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-danger" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.value >= 0 ? 'text-success' : 'text-danger'
                )}
              >
                {trend.value > 0 && '+'}
                {trend.value}%
              </span>
              <span className="text-xs text-muted">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
          <Icon className="h-6 w-6 text-accent" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
