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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-lg justify-around px-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={cx('flex flex-col items-center gap-1 pb-2 pt-2.5 text-2xs font-medium transition', active ? 'text-ink' : 'text-faint hover:text-muted')}>
                <Icon size={21} strokeWidth={active ? 2 : 1.6} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
