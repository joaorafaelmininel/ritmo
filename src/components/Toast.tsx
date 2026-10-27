'use client'

import { Check } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const ToastCtx = createContext<(message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const show = useCallback((text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage((current) => (current === text ? null : current)), 2600)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {message && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex justify-center px-4">
          <div className="flex animate-rise items-center gap-2 rounded-full bg-ink py-2.5 pl-3 pr-4 text-sm font-medium text-paper shadow-lift">
            <Check size={16} strokeWidth={2} />
            {message}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  )
}
