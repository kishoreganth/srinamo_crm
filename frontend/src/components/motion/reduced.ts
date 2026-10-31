import { useEffect, useState } from 'react';

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion() {
  const [reduce, setReduce] = useState(prefersReducedMotion);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduce;
}

export function afterCheck(then: () => void) {
  if (prefersReducedMotion()) then();
  else window.setTimeout(then, 280);
}
