'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Dumbbell, LayoutGrid, Sun, Wallet } from 'lucide-react'
import { cx } from './ui'

const ITEMS = [
  { href: '/', label: 'Hoje', icon: Sun },
  { href: '/treinos', label: 'Treinos', icon: Dumbbell },
  { href: '/gastos', label: 'Gastos', icon: Wallet },
  { href: '/estudos', label: 'Estudos', icon: BookOpen },
  { href: '/mais', label: 'Mais', icon: LayoutGrid },
]

const MORE_PATHS = ['/mais', '/dieta', '/atividades', '/perfumes', '/perfil']

export function BottomNav() {
  const pathname = usePathname()
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/mais') return MORE_PATHS.some((p) => pathname.startsWith(p))
    return pathname.startsWith(href)
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <ul className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-full bg-ink/95 p-1.5 shadow-lift backdrop-blur-xl">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className={cx('transition-all', active ? 'flex-[1.6]' : 'flex-1')}>
              <Link
                href={href}
                aria-label={label}
                className={cx(
                  'flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-all',
                  active ? 'bg-white text-ink' : 'text-white/55 hover:text-white',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                {active && <span>{label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
