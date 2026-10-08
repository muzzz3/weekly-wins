/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        wins: {
          'color-scheme': 'dark',
          'primary': '#14b8a6',
          'primary-content': '#ffffff',
          'secondary': '#2dd4bf',
          'accent': '#14b8a6',
          'neutral': '#1e2430',
          'base-100': '#0d1117',
          'base-200': '#161b22',
          'base-300': '#21262d',
          'base-content': '#e6edf3',
          'info': '#58a6ff',
          'success': '#3fb950',
          'warning': '#d29922',
          'error': '#f85149',
        },
      },
    ],
    darkTheme: 'wins',
  },
};

