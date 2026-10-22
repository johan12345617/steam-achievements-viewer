/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        steam: {
          dark: '#171a21', navy: '#1b2838', panel: '#213247',
          accent: '#66c0f4', text: '#c7d5e0', muted: '#9aafbf',
          border: '#34485e', green: '#a4d007',
        },
      },
    },
  },
  plugins: [],
};
