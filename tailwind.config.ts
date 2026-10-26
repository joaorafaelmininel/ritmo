import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        creme: '#FBF7F2',
        tinta: '#2B2433',
        ameixa: { 50: '#F6F1FA', 100: '#EADFF3', 500: '#8E5BB5', 600: '#7643A0', 700: '#5E3482' },
        pessego: { 100: '#FDE8DC', 500: '#EE8A5F' },
        salvia: { 100: '#E3F1E8', 500: '#4F9A6E' },
        ceu: { 100: '#E1EEFB', 500: '#3E7FC1' },
        mel: { 100: '#FCF1D4', 500: '#D49A1F' },
        rosa: { 100: '#FBE3EC', 500: '#D2557F' },
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: { suave: '0 2px 12px rgba(43, 36, 51, 0.06)' },
    },
  },
  plugins: [],
}

export default config
