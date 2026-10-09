/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0066CC',
          hover: '#0071E3',
          dark: '#004499',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          elevated: '#FFFFFF',
          secondary: '#F5F5F7',
        },
        ink: {
          DEFAULT: '#1D1D1F',
          secondary: '#6B7280',
          muted: '#86868B',
        },
        border: {
          DEFAULT: '#E5E5EA',
          strong: '#D2D2D7',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        button: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        soft: '0 2px 8px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
