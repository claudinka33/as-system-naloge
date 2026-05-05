/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // AS system CI barve
        'as-red': {
          DEFAULT: '#C8102E',
          50: '#FDF2F4',
          100: '#FCE5E9',
          200: '#F7C0C8',
          300: '#F19BA7',
          400: '#E55265',
          500: '#C8102E',
          600: '#A50D26',
          700: '#7B0A1D',
          800: '#520614',
          900: '#29030A',
        },
        'as-gray': {
          DEFAULT: '#3C3C3B',
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#C9C9C9',
          300: '#AAAAAA',
          400: '#6D6D6D',
          500: '#3C3C3B',
          600: '#323230',
          700: '#262625',
          800: '#1A1A19',
          900: '#0D0D0D',
        }
      }
    },
  },
  plugins: [],
}
