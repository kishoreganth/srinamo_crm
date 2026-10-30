import { forwardRef, useCallback, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, children, ...props }, ref) => {
    const localRef = useRef<HTMLDivElement | null>(null);
    const animateRef = useRef(false);
    const [animate, setAnimate] = useState(false);
    const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0, on: false });

    const setRefs = (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const measure = useCallback(() => {
      const root = localRef.current;
      if (!root) return;
      const active = root.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) {
        setBox((prev) => ({ ...prev, on: false }));
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      setBox({
        x: rect.left - rootRect.left,
        y: rect.top - rootRect.top,
        w: rect.width,
        h: rect.height,
        on: true,
      });
      if (!animateRef.current) {
        animateRef.current = true;
        requestAnimationFrame(() => setAnimate(true));
      }
    }, []);

    useLayoutEffect(() => {
      measure();
      const root = localRef.current;
      if (!root) return;
      const obs = new MutationObserver(measure);
      obs.observe(root, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
      const resize = new ResizeObserver(measure);
      resize.observe(root);
      return () => {
        obs.disconnect();
        resize.disconnect();
      };
    }, [measure]);

    return (
      <TabsPrimitive.List
        ref={setRefs}
        className={cn(
          'relative inline-flex min-h-10 max-w-full flex-wrap items-center justify-start gap-1 rounded-lg bg-background/70 p-1 text-muted',
          className
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-0 top-0 z-0 rounded-md bg-surface shadow-sm',
            animate && 'motion-tab'
          )}
          style={{
            width: box.w,
            height: box.h,
            transform: `translate(${box.x}px, ${box.y}px)`,
            opacity: box.on ? 1 : 0,
          }}
        />
        {children}
      </TabsPrimitive.List>
    );
  }
);
TabsList.displayName = 'TabsList';

const TabsTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-motion-2 ease-motion-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-ink',
        className
      )}
      {...props}
    />
  )
);
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  )
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
