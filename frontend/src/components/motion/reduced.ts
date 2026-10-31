export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function afterCheck(then: () => void) {
  if (prefersReducedMotion()) then();
  else window.setTimeout(then, 280);
}
