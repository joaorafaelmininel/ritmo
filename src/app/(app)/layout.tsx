import { BottomNav } from '@/components/BottomNav'
import { HouseholdProvider } from '@/components/HouseholdProvider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <main className="mx-auto min-h-dvh max-w-lg px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        {children}
      </main>
      <BottomNav />
    </HouseholdProvider>
  )
}
