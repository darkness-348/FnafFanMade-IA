/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fnaf: {
          dark: '#0a0a0c',
          card: '#121318',
          border: '#2a2b36',
          neon: '#00ffcc',
          danger: '#ff1e40',
          warning: '#ffb703',
          purple: '#9d4edd',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'Courier', 'monospace'],
        retro: ['"Press Start 2P"', 'monospace', 'sans-serif'],
      },
      animation: {
        'flicker': 'flicker 0.15s infinite',
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}

