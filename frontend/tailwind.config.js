/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface)',
        glass: 'var(--glass)',
        foreground: 'var(--text)',
        ink: 'var(--text)',
        muted: 'var(--text-secondary)',
        border: 'var(--border)',
        line: 'var(--border)',
        tint: 'var(--tint)',
        status: {
          available: 'var(--status-available-bg)',
          'available-fg': 'var(--status-available-fg)',
          occupied: 'var(--status-occupied-bg)',
          'occupied-fg': 'var(--status-occupied-fg)',
          cleaning: 'var(--status-cleaning-bg)',
          'cleaning-fg': 'var(--status-cleaning-fg)',
          maintenance: 'var(--status-maintenance-bg)',
          'maintenance-fg': 'var(--status-maintenance-fg)',
          inspected: 'var(--status-inspected-bg)',
          'inspected-fg': 'var(--status-inspected-fg)',
          neutral: 'var(--status-neutral-bg)',
          'neutral-fg': 'var(--status-neutral-fg)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        gold: 'var(--gold)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        shell: '20px',
      },
      transitionDuration: {
        glass: 'var(--dur-2)',
        'motion-1': 'var(--dur-1)',
        'motion-2': 'var(--dur-2)',
        'motion-3': 'var(--dur-3)',
        'motion-4': 'var(--dur-4)',
      },
      transitionTimingFunction: {
        'motion-out': 'var(--ease-out)',
        'motion-in-out': 'var(--ease-in-out)',
      },
      keyframes: {
        'motion-fade-up': {
          from: { opacity: '0', translate: '0 8px' },
          to: { opacity: '1', translate: '0 0' },
        },
        'motion-shimmer': {
          from: { backgroundPosition: '100% 0' },
          to: { backgroundPosition: '-100% 0' },
        },
        'motion-check': {
          from: { opacity: '0', scale: '0.8' },
          to: { opacity: '1', scale: '1' },
        },
        'motion-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
        'motion-row': {
          '0%, 100%': { opacity: '1' },
          '40%': { opacity: '0.72' },
        },
        'motion-slide-down': {
          from: { opacity: '0', translate: '0 -8px' },
          to: { opacity: '1', translate: '0 0' },
        },
        'motion-drawer-in': {
          from: { translate: '-100% 0' },
          to: { translate: '0 0' },
        },
        'motion-shake': {
          '0%, 100%': { translate: '0 0' },
          '25%': { translate: '-3px 0' },
          '75%': { translate: '3px 0' },
        },
        'motion-overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'motion-overlay-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'motion-panel-in': {
          from: { opacity: '0', translate: '0 8px' },
          to: { opacity: '1', translate: '0 0' },
        },
        'motion-panel-out': {
          from: { opacity: '1', translate: '0 0' },
          to: { opacity: '0', translate: '0 8px' },
        },
      },
      animation: {
        'motion-fade-up': 'motion-fade-up var(--dur-3) var(--ease-out) both',
        'motion-shimmer': 'motion-shimmer calc(var(--dur-4) * 3) var(--ease-in-out) infinite',
        'motion-check': 'motion-check var(--dur-3) var(--ease-out) both',
        'motion-pulse': 'motion-pulse var(--dur-4) var(--ease-out)',
        'motion-row': 'motion-row var(--dur-4) var(--ease-out)',
        'motion-slide-down': 'motion-slide-down var(--dur-2) var(--ease-out) both',
        'motion-drawer': 'motion-drawer-in var(--dur-3) var(--ease-out)',
        'motion-shake': 'motion-shake var(--dur-3) var(--ease-in-out)',
        'motion-overlay-in': 'motion-overlay-in var(--dur-2) var(--ease-out)',
        'motion-overlay-out': 'motion-overlay-out var(--dur-1) var(--ease-out)',
        'motion-panel-in': 'motion-panel-in var(--dur-2) var(--ease-out)',
        'motion-panel-out': 'motion-panel-out var(--dur-1) var(--ease-out)',
      },
    },
  },
  plugins: [],
};
