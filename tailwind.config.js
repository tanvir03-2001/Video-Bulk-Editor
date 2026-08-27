/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#12141a',
          raised: '#1a1d27',
          border: '#2a2f3d',
        },
        accent: {
          DEFAULT: '#3b82f6',
          muted: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        readable: '0.01em',
      },
    },
  },
  plugins: [],
};
