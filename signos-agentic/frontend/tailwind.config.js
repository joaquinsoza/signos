/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B5CF6',
        secondary: '#10B981',
        dark: {
          bg: '#0F172A',
          card: '#1E293B',
          hover: '#334155',
        }
      },
    },
  },
  plugins: [],
}

