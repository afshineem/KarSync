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
        primary: {
          DEFAULT: '#0284c7',
          hover: '#0369a1',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
        workshop: {
          dark: '#0f172a',
          card: '#1e293b',
          amber: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans Arabic"', '"Exo 2"', 'Vazirmatn', 'Inter', 'system-ui', 'sans-serif'],
        kurdish: ['"Noto Sans Arabic"', '"Exo 2"', 'Vazirmatn', 'Raza', 'Tahoma', 'sans-serif'],
        persian: ['"Noto Sans Arabic"', '"Exo 2"', 'Vazirmatn', 'Shabnam', 'Tahoma', 'sans-serif'],
        english: ['"Exo 2"', 'Inter', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
        mono: ['"Exo 2"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      }
    },
  },
  plugins: [],
}
