/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#06100d',
        panel: '#0d1a16',
        panelSoft: '#14241f',
        line: '#244139',
        limeFresh: '#b7f34a',
        mint: '#3ee681',
        aqua: '#4dd5c4',
        sun: '#f0b849',
        berry: '#db5b83',
      },
      boxShadow: {
        glow: '0 18px 60px rgba(62, 230, 129, 0.16)',
      },
    },
  },
  plugins: [],
};
