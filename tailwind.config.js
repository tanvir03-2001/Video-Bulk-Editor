/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--app-surface) / <alpha-value>)',
          raised: 'rgb(var(--app-surface-raised) / <alpha-value>)',
          border: 'rgb(var(--app-surface-border) / <alpha-value>)',
          hover: 'rgb(var(--app-surface-hover) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#3b82f6',
          muted: '#2563eb',
        },
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#fb7185',
      },
      fontFamily: {
        sans: ['Roboto', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"Roboto Mono"', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        readable: '0.01em',
      },
    },
  },
  plugins: [],
};
