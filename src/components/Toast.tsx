'use client'

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
          <div className="animate-fade rounded-full bg-tinta px-5 py-3 text-sm font-semibold text-white shadow-lg">{message}</div>
        </div>
      )}
    </ToastCtx.Provider>
  )
}
