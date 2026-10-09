/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#007AFF', hover: '#0A84FF', dark: '#0062CC' },
        surface: { DEFAULT: '#FFFFFF', elevated: '#FFFFFF', secondary: '#F2F2F7' },
        ink: { DEFAULT: '#1C1C1E', secondary: '#5F5F66', muted: '#76767D' },
        border: { DEFAULT: '#E6E6EB', strong: '#D1D1D6' },
        success: '#1E9E54',
        warning: '#C96A00',
        danger: '#E0333C',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: { card: '20px', button: '14px', sheet: '28px' },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.045)',
        soft: '0 2px 10px rgba(0,0,0,0.06)',
        float: '0 12px 32px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
