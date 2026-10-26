'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { Button, Card, EmptyState, Fab, PageHeader, Pills, SectionTitle, Spinner, Stat, cx } from '@/components/ui'
import { COMPLETION_OPTIONS, EFFORT_LEVELS, WEEKDAYS } from '@/lib/constants'
import { formatDuration, friendlyDay, isoDay, startOfWeek } from '@/lib/format'
import type { WorkoutPlan, WorkoutSession } from '@/lib/types'

export default function TreinosPage() {
  const { me, members, nameOf, avatarOf } = useHousehold()
  const [person, setPerson] = useState<string>(me.id)
  const [plans, setPlans] = useState<WorkoutPlan[] | null>(null)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])

  useEffect(() => {
    const supabase = supabaseBrowser()
    Promise.all([
      supabase.from('workout_plans').select('*, plan_exercises(id)').eq('archived', false).order('created_at'),
      supabase.from('workout_sessions').select('*').order('started_at', { ascending: false }).limit(40),
    ]).then(([p, s]) => {
      setPlans(p.data ?? [])
      setSessions(s.data ?? [])
    })
  }, [])

  if (!plans) return <Spinner />

  const today = new Date().getDay()
  const myPlans = plans.filter((p) => p.assigned_to === person || p.assigned_to === null)
  const mySessions = sessions.filter((s) => s.user_id === person)
  const weekStart = startOfWeek()
  const thisWeek = mySessions.filter((s) => isoDay(new Date(s.started_at)) >= weekStart && s.completion !== 'nao')
  const minutesWeek = thisWeek.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)

  return (
    <>
      <PageHeader title="Treinos" subtitle="Monte, faça e acompanhe" />

      {members.length > 1 && (
        <Pills
          options={members.map((m) => ({ value: m.id, label: `${m.avatar} ${m.display_name}` }))}
          value={person}
          onChange={setPerson}
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Treinos na semana" value={thisWeek.length} tone="salvia" />
        <Stat label="Tempo na semana" value={formatDuration(minutesWeek)} tone="ceu" />
      </div>

      <SectionTitle action={<Link href="/treinos/plano/novo" className="text-sm font-bold text-ameixa-600">+ Novo treino</Link>}>
        Treinos de {nameOf(person)}
      </SectionTitle>

      {myPlans.length === 0 ? (
        <EmptyState
          emoji="🏋️‍♀️"
          title="Nenhum treino montado ainda"
          text="Monte um treino com os exercícios, séries e cargas. Depois é só tocar em Começar."
          action={
            <Link href="/treinos/plano/novo">
              <Button>Montar treino</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {myPlans
            .slice()
            .sort((a, b) => Number(b.weekdays.includes(today)) - Number(a.weekdays.includes(today)))
            .map((plan) => {
              const isToday = plan.weekdays.includes(today)
              return (
                <Card key={plan.id} className={cx(isToday && 'ring-2 ring-ameixa-500')}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ameixa-50 text-2xl">{plan.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold">{plan.name}</p>
                        {isToday && <span className="rounded-full bg-ameixa-600 px-2 py-0.5 text-[10px] font-bold text-white">HOJE</span>}
                      </div>
                      <p className="text-sm text-tinta/60">
                        {plan.plan_exercises?.length ?? 0} exercícios
                        {plan.weekdays.length > 0 && ` · ${plan.weekdays.map((d) => WEEKDAYS[d]).join(', ')}`}
                      </p>
                    </div>
                    <Link href={`/treinos/plano/${plan.id}`} className="px-1 text-sm font-semibold text-tinta/50">
                      Editar
                    </Link>
                  </div>
                  {person === me.id || plan.assigned_to === null ? (
                    <Link href={`/treinos/fazer/${plan.id}`} className="mt-3 block">
                      <Button block>▶ Começar treino</Button>
                    </Link>
                  ) : (
                    <p className="mt-3 text-center text-xs text-tinta/50">
                      {avatarOf(person)} {nameOf(person)} inicia este treino no próprio celular
                    </p>
                  )}
                </Card>
              )
            })}
        </div>
      )}

      <SectionTitle>Histórico</SectionTitle>
      {mySessions.length === 0 ? (
        <p className="text-sm text-tinta/50">Os treinos realizados aparecem aqui, com cansaço, humor e tempo.</p>
      ) : (
        <div className="space-y-2">
          {mySessions.map((s) => {
            const completion = COMPLETION_OPTIONS.find((c) => c.value === s.completion)
            const effort = EFFORT_LEVELS.find((e) => e.value === s.effort)
            return (
              <Card key={s.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.mood ?? completion?.emoji ?? '💪'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.plan_name}</p>
                    <p className="text-xs text-tinta/55">
                      {friendlyDay(isoDay(new Date(s.started_at)))}
                      {s.duration_minutes ? ` · ${formatDuration(s.duration_minutes)}` : ''}
                      {completion ? ` · ${completion.label}` : ''}
                    </p>
                    {s.feeling_note && <p className="mt-1 text-sm text-tinta/70">“{s.feeling_note}”</p>}
                  </div>
                  {effort && (
                    <div className="text-center">
                      <p className="text-lg">{effort.emoji}</p>
                      <p className="text-[10px] font-semibold text-tinta/50">{effort.label}</p>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Fab href="/treinos/plano/novo" label="Treino" />
    </>
  )
}
