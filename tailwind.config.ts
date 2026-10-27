import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3F3F5',
        surface: '#FFFFFF',
        sunken: '#EBEBEF',
        line: '#E4E4E9',
        ink: { DEFAULT: '#0B0B0F', soft: '#2A2A33' },
        muted: '#6E6E7A',
        faint: '#A3A3AE',
        accent: { DEFAULT: '#2F6BFF', soft: '#E7EEFF', ink: '#1F52D6' },
        good: { DEFAULT: '#12A150', soft: '#E3F5EA' },
        warn: { DEFAULT: '#E8870E', soft: '#FDF1E1' },
        bad: { DEFAULT: '#E5484D', soft: '#FDE8E9' },
        data: {
          clay: '#FF6B3D',
          sage: '#12A150',
          slate: '#2F6BFF',
          ochre: '#F5A524',
          plum: '#8E5CF7',
          stone: '#8E8E99',
          teal: '#0EA5A4',
          rose: '#F0508C',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // "display": títulos e números de destaque
        serif: ['"Geist Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        lift: '0 1px 2px rgba(11, 11, 15, 0.04), 0 10px 30px -12px rgba(11, 11, 15, 0.18)',
        card: '0 1px 2px rgba(11, 11, 15, 0.04)',
      },
      letterSpacing: { label: '0.08em' },
    },
  },
  plugins: [],
}

export default config
