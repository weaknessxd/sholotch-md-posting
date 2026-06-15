/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — red accent (was blue in attmpt_editor)
        bg: '#FFFFFF',
        accent: '#FF2D2D',
        'accent-strong': '#FF3B30',
        ink: '#0A0A0A',
        card: '#E5E5E5',
        muted: '#B8B8B8',

        // Telegram theme tokens — driven by --tg-theme-* CSS vars.
        // In TMA, Telegram WebView injects these automatically.
        // In non-TMA, defaults come from index.css :root (+ prefers-color-scheme).
        tg: {
          bg: 'var(--tg-theme-bg-color)',
          text: 'var(--tg-theme-text-color)',
          hint: 'var(--tg-theme-hint-color)',
          link: 'var(--tg-theme-link-color)',
          button: 'var(--tg-theme-button-color)',
          'button-text': 'var(--tg-theme-button-text-color)',
          'secondary-bg': 'var(--tg-theme-secondary-bg-color)',
          'accent-text': 'var(--tg-theme-accent-text-color)',
          'header-bg': 'var(--tg-theme-header-bg-color)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Section headers. Real design uses Xolonium (not on npm) — Orbitron
        // is a close techno stand-in; drop a Xolonium woff2 in to swap.
        display: ['Orbitron', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
