/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      colors: {
        panel: '#ffffff',
      },
      boxShadow: {
        panel: '0 8px 28px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
}
