import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

let themeReady = false;
let themeTimer = 0;

export function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && systemDark());
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (themeReady && !reduce) {
    root.classList.add('theme-swap');
    window.clearTimeout(themeTimer);
    themeTimer = window.setTimeout(() => root.classList.remove('theme-swap'), 180);
  }
  root.classList.toggle('dark', dark);
  themeReady = true;
}

function readMode(): ThemeMode {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export const useThemeStore = create<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    localStorage.setItem('theme', mode);
    applyTheme(mode);
    set({ mode });
  },
}));

applyTheme(readMode());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (readMode() === 'system') applyTheme('system');
});
