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
        background: 'var(--background)',
        'background-dark': 'var(--background-dark)',
      },
      animation: {
        'spin': 'spin 1s linear infinite',
      },
      backdropBlur: {
        'card': 'blur(20px)',
      },
    },
  },
  plugins: [],
} 