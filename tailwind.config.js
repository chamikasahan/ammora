/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          400: '#8b5cf6',
          500: '#8057F5',
          600: '#6d4ce6',
        },
        navy: '#090B14',
      },
    },
  },
  plugins: [],
}
