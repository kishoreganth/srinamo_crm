import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './reduced';

export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  replay = false,
}: {
  value: number;
  format?: (n: number) => string;
  replay?: boolean;
}) {
  const from = useRef(0);
  const played = useRef(false);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    const reduce = prefersReducedMotion();
    const start = played.current ? from.current : 0;
    if (reduce || (played.current && !replay)) {
      setShown(value);
      from.current = value;
      played.current = true;
      return;
    }
    const begun = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - begun) / 400);
      const eased = 1 - (1 - t) * (1 - t);
      const next = start + (value - start) * eased;
      setShown(next);
      if (t < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      from.current = value;
      played.current = true;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, replay]);

  return <span>{format(shown)}</span>;
}
