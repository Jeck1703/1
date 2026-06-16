/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        solar: {
          green: '#166534',
          'green-light': '#4ade80',
          yellow: '#facc15',
          'yellow-dark': '#ca8a04',
          dark: '#111827',
          gray: '#64748b',
        }
      }
    },
  },
  plugins: [],
}
