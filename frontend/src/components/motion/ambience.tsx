import { useReducedMotion } from './reduced';

export function Ambience({ shift = '0px 0px' }: { shift?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden style={{ translate: shift }}>
      <div className="motion-orb motion-orb-a" />
      <div className="motion-orb motion-orb-b" />
      <div className="motion-grain" />
    </div>
  );
}
