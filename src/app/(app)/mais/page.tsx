'use client'

import Link from 'next/link'
import { BookOpen, ChevronRight, Dumbbell, Flower2, ListChecks, Salad, Wallet } from 'lucide-react'
import { useHousehold } from '@/components/HouseholdProvider'
import { Card, Monogram, PageHeader } from '@/components/ui'

const MODULES = [
  { href: '/treinos', icon: Dumbbell, title: 'Treinos', text: 'Planos, execução e histórico' },
  { href: '/dieta', icon: Salad, title: 'Dieta', text: 'Refeições e hidratação' },
  { href: '/gastos', icon: Wallet, title: 'Gastos', text: 'Notas fiscais e lançamentos' },
  { href: '/atividades', icon: ListChecks, title: 'Atividades', text: 'Tarefas e compromissos' },
  { href: '/perfumes', icon: Flower2, title: 'Perfumes', text: 'Coleção e diário de uso' },
  { href: '/estudos', icon: BookOpen, title: 'Estudos', text: 'Idiomas e vocabulário' },
]

export default function MaisPage() {
  const { me, household, colorOf } = useHousehold()
  return (
    <>
      <PageHeader eyebrow={household?.name} title="Tudo" />

      <Card className="divide-y divide-line !py-0">
        {MODULES.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="flex items-center gap-4 py-4">
            <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-soft" />
            <span className="flex-1">
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-muted">{text}</span>
            </span>
            <ChevronRight size={16} className="text-faint" />
          </Link>
        ))}
      </Card>

      <Link href="/perfil" className="mt-4 block">
        <Card className="flex items-center gap-4 transition hover:border-faint">
          <Monogram name={me.display_name} color={colorOf(me.id)} size={44} />
          <span className="flex-1">
            <span className="block font-medium">{me.display_name}</span>
            <span className="block text-xs text-muted">Perfil, metas e convite</span>
          </span>
          <ChevronRight size={16} className="text-faint" />
        </Card>
      </Link>
    </>
  )
}
