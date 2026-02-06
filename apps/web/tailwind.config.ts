import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['10px', { lineHeight: '14px' }],
        'sm': ['12px', { lineHeight: '16px' }],
        'base': ['14px', { lineHeight: '20px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['18px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['32px', { lineHeight: '40px' }],
      },
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9e1ff',
          300: '#89cfff',
          400: '#52b4ff',
          500: '#2aabee',
          600: '#0d7bcc',
          700: '#0e63a5',
          800: '#125488',
          900: '#144670',
          950: '#112c4a',
        },
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
} satisfies Config
