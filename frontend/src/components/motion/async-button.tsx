import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { prefersReducedMotion } from './reduced';

export function AsyncButton({
  pending = false,
  failed = false,
  children,
  disabled,
  ...props
}: ButtonProps & { pending?: boolean; failed?: boolean }) {
  const [check, setCheck] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setCheck(false);
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    if (failed || prefersReducedMotion()) return;
    setCheck(true);
    const timer = window.setTimeout(() => setCheck(false), 280);
    return () => window.clearTimeout(timer);
  }, [pending, failed]);

  return (
    <Button disabled={disabled || pending} {...props}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : check ? <Check className="motion-check h-4 w-4" /> : children}
    </Button>
  );
}
