import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/Toast'
import { ServiceWorker } from '@/components/ServiceWorker'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ritmo',
  description: 'Assistente pessoal: treinos, alimentação, finanças, tarefas, perfumes e estudos — para você e quem mora com você.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Ritmo', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#F3F3F5',
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
