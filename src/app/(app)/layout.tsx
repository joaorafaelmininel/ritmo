import { BottomNav } from '@/components/BottomNav'
import { HouseholdProvider } from '@/components/HouseholdProvider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <main className="mx-auto min-h-dvh max-w-lg px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
        {children}
      </main>
      <BottomNav />
    </HouseholdProvider>
  )
}
