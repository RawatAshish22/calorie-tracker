/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0F1115',       // Deep Slate
        panel: '#16191F',
        panelSoft: '#1E222A',
        line: '#282D38',
        limeFresh: '#FFB020', // Luxurious Gold
        mint: '#FF6B35',      // Ember Orange
        aqua: '#E83151',      // Deep Crimson
        sun: '#F9E076',       // Champagne
        berry: '#4A90E2',     // Azure Blue
      },
      boxShadow: {
        glow: '0 18px 60px rgba(62, 230, 129, 0.16)',
      },
    },
  },
  plugins: [],
};
