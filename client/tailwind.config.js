/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        campfire: {
          ember: '#ff6b35',
          flame: '#f7c59f',
          gold: '#ffbe0b',
          night: '#0b0f19',
          indigo: '#131b2e',
          forest: '#1a2421',
          blood: '#9e2a2b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
