import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/Toast'
import { ServiceWorker } from '@/components/ServiceWorker'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nós Dois',
  description: 'Assistente pessoal do casal: treinos, dieta, gastos, atividades, perfumes e estudos.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Nós Dois', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#F5F3EF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  )
}
