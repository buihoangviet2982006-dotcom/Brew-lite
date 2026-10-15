/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brew: {
          50: '#fcf8f2',
          100: '#f7eee0',
          200: '#edd8bc',
          300: '#e0bc91',
          400: '#d19962',
          500: '#b8773c',
          600: '#9b5b2e',
          700: '#7c4427',
          800: '#673824',
          900: '#562f21',
          950: '#30170f',
        },
      },
    },
  },
  plugins: [],
};
