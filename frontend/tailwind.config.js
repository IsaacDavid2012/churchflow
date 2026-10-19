const jmrGold = {
  50: '#fbf8f3',
  100: '#f5ede1',
  200: '#eadbc4',
  300: '#dcc29e',
  400: '#d0af83',
  500: '#b38856',
  600: '#c59c6c',
  700: '#9e7343',
  800: '#825d35',
  900: '#6a4c2b',
  950: '#3a2815',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: jmrGold,
        red: jmrGold,
        rose: jmrGold,
      }
    },
  },
  plugins: [],
}
