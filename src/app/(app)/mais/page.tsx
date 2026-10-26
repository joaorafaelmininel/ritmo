'use client'

import Link from 'next/link'
import { useHousehold } from '@/components/HouseholdProvider'
import { PageHeader } from '@/components/ui'

const MODULES = [
  { href: '/treinos', emoji: '💪', title: 'Treinos', text: 'Montar e fazer treinos', bg: 'bg-ameixa-50' },
  { href: '/dieta', emoji: '🥗', title: 'Dieta', text: 'Refeições e água', bg: 'bg-salvia-100' },
  { href: '/gastos', emoji: '💸', title: 'Gastos', text: 'Notas e lançamentos', bg: 'bg-mel-100' },
  { href: '/atividades', emoji: '🗓️', title: 'Atividades', text: 'Tarefas e compromissos', bg: 'bg-pessego-100' },
  { href: '/perfumes', emoji: '🌸', title: 'Perfumes', text: 'Coleção e diário', bg: 'bg-rosa-100' },
  { href: '/estudos', emoji: '📚', title: 'Estudos', text: 'Idiomas e vocabulário', bg: 'bg-ceu-100' },
]

export default function MaisPage() {
  const { me } = useHousehold()
  return (
    <>
      <PageHeader title="Tudo" subtitle="Todos os módulos do app" />
      <div className="grid grid-cols-2 gap-3">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href} className={`rounded-2xl p-4 transition active:scale-[0.98] ${m.bg}`}>
            <span className="text-3xl">{m.emoji}</span>
            <p className="mt-2 font-extrabold">{m.title}</p>
            <p className="text-xs text-tinta/60">{m.text}</p>
          </Link>
        ))}
      </div>
      <Link href="/perfil" className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-suave">
        <span className="text-3xl">{me.avatar}</span>
        <span className="flex-1">
          <span className="block font-bold">{me.display_name}</span>
          <span className="block text-xs text-tinta/55">Perfil, metas e convite do par</span>
        </span>
        <span className="text-tinta/30">›</span>
      </Link>
    </>
  )
}
