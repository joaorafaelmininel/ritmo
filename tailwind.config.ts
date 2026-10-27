import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F3EF',
        surface: '#FFFFFF',
        sunken: '#EEEBE5',
        line: '#E4E0D8',
        ink: { DEFAULT: '#1D1C1A', soft: '#3A3835' },
        muted: '#77726A',
        faint: '#A39E95',
        accent: { DEFAULT: '#9A4A2C', soft: '#F2E7E1', ink: '#7A3820' },
        good: { DEFAULT: '#4F6F58', soft: '#E6ECE6' },
        warn: { DEFAULT: '#A4672A', soft: '#F4EADD' },
        bad: { DEFAULT: '#A23B3B', soft: '#F5E3E1' },
        // paleta de dados (categorias, gráficos)
        data: {
          clay: '#B0623F',
          sage: '#6F8C74',
          slate: '#5D6E86',
          ochre: '#B48C3F',
          plum: '#7D5D7B',
          stone: '#8C857A',
          teal: '#4E8282',
          rose: '#B76E79',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      boxShadow: {
        lift: '0 1px 2px rgba(29, 28, 26, 0.04), 0 8px 24px -12px rgba(29, 28, 26, 0.12)',
      },
      letterSpacing: { label: '0.08em' },
    },
  },
  plugins: [],
}

export default config
