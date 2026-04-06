/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        steam: {
          dark: '#0f1117',
          darker: '#0a0d13',
          card: '#1a1f2e',
          'card-hover': '#1e2438',
          border: '#2a3147',
          accent: '#4f9eed',
          'accent-hover': '#66adf5',
          teal: '#4db8b8',
          'teal-hover': '#5ecece',
          gold: '#f0a500',
          'gold-light': '#fbbf24',
          muted: '#8892a4',
          text: '#c6d4df',
          'text-bright': '#e8edf2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'steam-gradient': 'linear-gradient(135deg, #0f1117 0%, #131a2e 50%, #0f1117 100%)',
        'card-gradient': 'linear-gradient(135deg, #1a1f2e 0%, #1e2438 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      boxShadow: {
        'steam': '0 4px 24px rgba(79, 158, 237, 0.15)',
        'steam-lg': '0 8px 40px rgba(79, 158, 237, 0.2)',
        'gold': '0 4px 24px rgba(240, 165, 0, 0.2)',
        'card': '0 2px 16px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
