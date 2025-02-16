/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif'
        ],
      },
      fontSize: {
        'logo': '2.5rem',
        'base': '15px',
        'sm': '13px',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
      },
      colors: {
        background: '#f5f5f7',
        'input-bg': 'rgba(249, 250, 251, 0.5)', // gray-50 with 50% opacity
      },
      backdropBlur: {
        'card': '20px',
      },
      spacing: {
        '18': '4.5rem', // Custom spacing for 72px
      },
    },
  },
  plugins: [],
} 