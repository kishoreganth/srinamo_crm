import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-motion-2 ease-motion-out',
  {
    variants: {
      variant: {
        default: 'bg-status-available text-status-available-fg',
        secondary: 'bg-background text-ink',
        destructive: 'bg-status-maintenance text-status-maintenance-fg',
        outline: 'border border-line bg-surface text-ink',
        success: 'bg-status-available text-status-available-fg',
        warning: 'bg-status-cleaning text-status-cleaning-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
