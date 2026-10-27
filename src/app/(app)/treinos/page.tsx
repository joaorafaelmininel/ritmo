'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Dumbbell, Play } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonSwitch, useHousehold } from '@/components/HouseholdProvider'
import { Button, Card, EmptyState, Fab, Metric, PageHeader, SectionTitle, Spinner, TextLink, cx } from '@/components/ui'
import { COMPLETION_OPTIONS, EFFORT_LEVELS, WEEKDAYS, moodLabel } from '@/lib/constants'
import { formatDuration, friendlyDay, isoDay, startOfWeek } from '@/lib/format'
import type { WorkoutPlan, WorkoutSession } from '@/lib/types'

export default function TreinosPage() {
  const { me, nameOf } = useHousehold()
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
  const isMe = person === me.id
  const myPlans = plans
    .filter((p) => p.assigned_to === person || p.assigned_to === null)
    .sort((a, b) => Number(b.weekdays.includes(today)) - Number(a.weekdays.includes(today)))
  const mySessions = sessions.filter((s) => s.user_id === person)
  const weekStart = startOfWeek()
  const thisWeek = mySessions.filter((s) => isoDay(new Date(s.started_at)) >= weekStart && s.completion !== 'nao')
  const minutesWeek = thisWeek.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
  const efforts = thisWeek.filter((s) => s.effort)
  const avgEffort = efforts.length ? efforts.reduce((s, x) => s + (x.effort ?? 0), 0) / efforts.length : null

  return (
    <>
      <PageHeader eyebrow="Movimento" title="Treinos" />
      <PersonSwitch value={person} onChange={setPerson} />

      <Card className="grid grid-cols-3 divide-x divide-line !px-0">
        <Metric className="px-4" label="Semana" value={thisWeek.length} detail={thisWeek.length === 1 ? 'treino' : 'treinos'} />
        <Metric className="px-4" label="Tempo" value={formatDuration(minutesWeek)} detail="nesta semana" />
        <Metric className="px-4" label="Esforço" value={avgEffort ? avgEffort.toFixed(1).replace('.', ',') : '—'} detail="média de 1 a 5" />
      </Card>

      <SectionTitle action={<TextLink href="/treinos/plano/novo">Novo treino</TextLink>}>
        {isMe ? 'Seus treinos' : `Treinos de ${nameOf(person)}`}
      </SectionTitle>

      {myPlans.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Nenhum treino ainda"
          text="Monte um treino com exercícios, séries e cargas. Depois é só iniciar."
          action={
            <Link href="/treinos/plano/novo">
              <Button>Montar treino</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {myPlans.map((plan) => {
            const isToday = plan.weekdays.includes(today)
            return (
              <Card key={plan.id} className={cx('!p-0', isToday && 'border-ink')}>
                <div className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    {isToday && <p className="mb-1 text-2xs font-medium uppercase tracking-label text-accent">Hoje</p>}
                    <p className="truncate font-serif text-[26px] leading-tight">{plan.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {plan.plan_exercises?.length ?? 0} {plan.plan_exercises?.length === 1 ? 'exercício' : 'exercícios'}
                      {plan.assigned_to === null && ' · para os dois'}
                    </p>
                  </div>
                  <TextLink href={`/treinos/plano/${plan.id}`}>Editar</TextLink>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <div className="flex gap-1">
                    {WEEKDAYS.map((d, i) => (
                      <span
                        key={d}
                        className={cx(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium',
                          plan.weekdays.includes(i) ? 'bg-ink text-paper' : 'text-faint',
                        )}
                      >
                        {d[0]}
                      </span>
                    ))}
                  </div>
                  {isMe ? (
                    <Link href={`/treinos/fazer/${plan.id}`}>
                      <Button variant={isToday ? 'accent' : 'secondary'} icon={Play} className="h-9 px-3.5 text-[13px]">
                        Iniciar
                      </Button>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted">Iniciado no app de {nameOf(person)}</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <SectionTitle>Histórico</SectionTitle>
      {mySessions.length === 0 ? (
        <p className="text-sm text-muted">Os treinos realizados aparecem aqui, com esforço, disposição e duração.</p>
      ) : (
        <Card className="divide-y divide-line !py-0">
          {mySessions.map((s) => {
            const completion = COMPLETION_OPTIONS.find((c) => c.value === s.completion)
            const effort = EFFORT_LEVELS.find((e) => e.value === s.effort)
            const mood = moodLabel(s.mood)
            return (
              <div key={s.id} className="py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{s.plan_name}</p>
                  <p className="num shrink-0 text-xs text-muted">{friendlyDay(isoDay(new Date(s.started_at)))}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {completion && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cx('h-1.5 w-1.5 rounded-full', s.completion === 'completo' ? 'bg-good' : s.completion === 'parcial' ? 'bg-warn' : 'bg-bad')}
                      />
                      {completion.label}
                    </span>
                  )}
                  {s.duration_minutes ? <span className="num">{formatDuration(s.duration_minutes)}</span> : null}
                  {effort && <span>Esforço {effort.value}/5 · {effort.label}</span>}
                  {mood && <span>{mood}</span>}
                </div>
                {s.feeling_note && <p className="mt-2 font-serif text-[17px] italic leading-snug text-ink-soft">“{s.feeling_note}”</p>}
              </div>
            )
          })}
        </Card>
      )}

      <Fab href="/treinos/plano/novo" label="Treino" />
    </>
  )
}
