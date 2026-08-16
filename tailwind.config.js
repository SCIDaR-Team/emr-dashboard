/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens — every value resolves through a CSS variable in
        // src/styles/globals.css so light/dark swap in one place.
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        page: 'hsl(var(--page) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },

        // Brand — deep forest green, from the ERA Figma prototype.
        brand: {
          50: 'hsl(var(--brand-50) / <alpha-value>)',
          100: 'hsl(var(--brand-100) / <alpha-value>)',
          500: 'hsl(var(--brand-500) / <alpha-value>)',
          600: 'hsl(var(--brand-600) / <alpha-value>)',
          700: 'hsl(var(--brand-700) / <alpha-value>)',
          900: 'hsl(var(--brand-900) / <alpha-value>)',
        },

        // The navigation rail. Dark green in both schemes — see globals.css.
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
        },

        // Readiness bands. These three carry meaning across every surface —
        // donuts, badges, choropleth, checklists, roadmap. Never hand-pick a
        // status colour; go through statusColor() in src/lib/bands.ts.
        ready: {
          DEFAULT: 'hsl(var(--ready) / <alpha-value>)',
          wash: 'hsl(var(--ready-wash) / <alpha-value>)',
        },
        moderate: {
          DEFAULT: 'hsl(var(--moderate) / <alpha-value>)',
          wash: 'hsl(var(--moderate-wash) / <alpha-value>)',
        },
        notready: {
          DEFAULT: 'hsl(var(--not-ready) / <alpha-value>)',
          wash: 'hsl(var(--not-ready-wash) / <alpha-value>)',
        },
        nodata: 'hsl(var(--no-data) / <alpha-value>)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        // Anything that floats above the page: popovers, dialogs, drawers, toasts.
        pop: '0 4px 12px -2px rgb(0 0 0 / 0.10), 0 12px 32px -8px rgb(0 0 0 / 0.18)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Overlay entrances. Kept in CSS rather than a motion library: these are
      // the only animations in the app, and the reduced-motion rule in
      // globals.css already neutralises them for anyone who has asked.
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(2rem) scale(0.95)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 140ms ease-out',
        'dialog-in': 'dialog-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-left': 'slide-in-left 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'toast-in': 'toast-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
