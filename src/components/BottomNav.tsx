'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cx } from './ui'

const ITEMS = [
  { href: '/', label: 'Início', emoji: '🏠' },
  { href: '/treinos', label: 'Treinos', emoji: '💪' },
  { href: '/gastos', label: 'Gastos', emoji: '💸' },
  { href: '/estudos', label: 'Estudos', emoji: '📚' },
  { href: '/mais', label: 'Mais', emoji: '✨' },
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <ul className="mx-auto flex max-w-lg justify-around">
        {ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition', active ? 'text-ameixa-600' : 'text-tinta/45')}
              >
                <span className={cx('text-xl transition', active ? 'scale-110' : 'grayscale opacity-70')}>{item.emoji}</span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
