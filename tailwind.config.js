/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0B0C10',
        panel: '#1F2833',
        panelSoft: '#2D3744',
        line: '#344150',
        limeFresh: '#00F0FF', // Cyan
        mint: '#B026FF',      // Neon Purple
        aqua: '#FF007F',      // Hot Pink
        sun: '#FFEA00',       // Cyber Yellow
        berry: '#FF3366',     // Neon Coral
      },
      boxShadow: {
        glow: '0 18px 60px rgba(62, 230, 129, 0.16)',
      },
    },
  },
  plugins: [],
};
