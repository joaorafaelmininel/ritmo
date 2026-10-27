'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight, Camera, Check, ChevronRight, Droplet, Dumbbell, Flower2, Plus, Timer, UtensilsCrossed } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { Card, Progress, SectionTitle, Spinner, TextLink, cx } from '@/components/ui'
import { formatDuration, greeting, isoDay, longToday, money, startOfMonth, startOfWeek } from '@/lib/format'
import type { Activity, Perfume, WorkoutPlan, WorkoutSession } from '@/lib/types'

type Summary = {
  plans: WorkoutPlan[]
  sessionsToday: WorkoutSession[]
  monthTotal: number
  activities: Activity[]
  perfumeToday: string | null
  hasPerfumes: boolean
  studyWeek: number
  dueCards: number
  water: number
  mealsToday: number
}

export default function HojePage() {
  const { me, partner } = useHousehold()
  const [data, setData] = useState<Summary | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()
    const today = isoDay()
    Promise.all([
      supabase.from('workout_plans').select('*').eq('archived', false),
      supabase.from('workout_sessions').select('*').eq('user_id', me.id).gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('expenses').select('amount').gte('spent_on', startOfMonth()),
      supabase.from('activities').select('*').eq('done', false).or(`due_on.lte.${today},due_on.is.null`).order('due_on', { nullsFirst: false }).limit(20),
      supabase.from('perfume_wears').select('perfume_id').eq('user_id', me.id).eq('worn_on', today).limit(1),
      supabase.from('perfumes').select('id, name').eq('owner_id', me.id),
      supabase.from('study_sessions').select('minutes').eq('user_id', me.id).gte('studied_on', startOfWeek()),
      supabase.from('vocab_cards').select('id', { count: 'exact', head: true }).eq('user_id', me.id).lte('next_review', today),
      supabase.from('water_logs').select('glasses').eq('user_id', me.id).eq('day', today).maybeSingle(),
      supabase.from('meals').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('eaten_on', today),
    ]).then(([plans, sessions, expenses, activities, wear, perfumes, study, cards, water, meals]) => {
      const perfumeList = (perfumes.data ?? []) as Pick<Perfume, 'id' | 'name'>[]
      const worn = wear.data?.[0]?.perfume_id
      setData({
        plans: plans.data ?? [],
        sessionsToday: sessions.data ?? [],
        monthTotal: (expenses.data ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0),
        activities: (activities.data ?? []).filter((a: Activity) => a.assigned_to === null || a.assigned_to === me.id),
        perfumeToday: worn ? perfumeList.find((p) => p.id === worn)?.name ?? 'Perfume' : null,
        hasPerfumes: perfumeList.length > 0,
        studyWeek: (study.data ?? []).reduce((s: number, x: { minutes: number }) => s + x.minutes, 0),
        dueCards: cards.count ?? 0,
        water: water.data?.glasses ?? 0,
        mealsToday: meals.count ?? 0,
      })
    })
  }, [me.id])

  async function completeActivity(a: Activity) {
    setData((d) => d && { ...d, activities: d.activities.filter((x) => x.id !== a.id) })
    await supabaseBrowser().from('activities').update({ done: true, done_at: new Date().toISOString() }).eq('id', a.id)
  }

  const weekday = new Date().getDay()
  const todayPlans = data?.plans.filter((p) => (p.assigned_to === me.id || p.assigned_to === null) && p.weekdays.includes(weekday)) ?? []
  const trained = (data?.sessionsToday.length ?? 0) > 0
  const studyGoal = me.weekly_study_goal_minutes || 150

  return (
    <>
      <header className="pb-7 pt-3">
        <p className="text-2xs font-medium uppercase tracking-label text-muted first-letter:uppercase">{longToday()}</p>
        <h1 className="mt-2 font-serif text-[44px] leading-[1.02] tracking-[-0.01em]">
          {greeting()},<br />
          <span className="italic">{me.display_name}.</span>
        </h1>
        {partner && <p className="mt-2 text-sm text-muted">Em casa com {partner.display_name}</p>}
      </header>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {[
          { href: '/gastos/novo', icon: Camera, label: 'Nota fiscal' },
          { href: '/perfumes', icon: Flower2, label: 'Perfume' },
          { href: '/dieta', icon: UtensilsCrossed, label: 'Refeição' },
          { href: '/estudos', icon: Timer, label: 'Estudar' },
          { href: '/atividades', icon: Plus, label: 'Tarefa' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={label}
            href={href}
            className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-medium text-ink-soft transition hover:border-faint active:scale-95"
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          {/* Treino */}
          <SectionTitle>Treino</SectionTitle>
          {trained ? (
            <Card className="flex items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-good text-white">
                <Check size={18} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="font-medium">Treino concluído</p>
                <p className="truncate text-sm text-muted">
                  {data.sessionsToday.map((s) => `${s.plan_name}${s.duration_minutes ? ` · ${formatDuration(s.duration_minutes)}` : ''}`).join(' / ')}
                </p>
              </div>
            </Card>
          ) : todayPlans.length > 0 ? (
            <div className="space-y-2">
              {todayPlans.map((p) => (
                <Link key={p.id} href={`/treinos/fazer/${p.id}`} className="group block">
                  <div className="flex items-center gap-4 rounded-2xl bg-ink p-5 text-paper transition active:scale-[0.99]">
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-medium uppercase tracking-label text-paper/60">Programado para hoje</p>
                      <p className="mt-1 truncate font-serif text-[28px] leading-tight">{p.name}</p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition group-hover:translate-x-0.5">
                      <ArrowUpRight size={20} strokeWidth={1.75} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/treinos" className="block">
              <Card className="flex items-center gap-4 transition hover:border-faint">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-muted">
                  <Dumbbell size={18} strokeWidth={1.6} />
                </span>
                <div className="flex-1">
                  <p className="font-medium">Dia de descanso</p>
                  <p className="text-sm text-muted">Nenhum treino programado para hoje</p>
                </div>
                <ChevronRight size={18} className="text-faint" />
              </Card>
            </Link>
          )}

          {/* Resumo */}
          <SectionTitle>Resumo</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/gastos" className="rounded-2xl border border-line bg-surface p-4 transition hover:border-faint">
              <p className="text-2xs font-medium uppercase tracking-label text-muted">Gastos do mês</p>
              <p className="figure mt-3 text-[30px] leading-none">{money(data.monthTotal)}</p>
            </Link>
            <Link href="/estudos" className="rounded-2xl border border-line bg-surface p-4 transition hover:border-faint">
              <p className="text-2xs font-medium uppercase tracking-label text-muted">Estudo na semana</p>
              <p className="figure mt-3 text-[30px] leading-none">{formatDuration(data.studyWeek)}</p>
              <Progress value={data.studyWeek / studyGoal} tone="accent" className="mt-3" />
              <p className="mt-1.5 text-xs text-muted">meta {formatDuration(studyGoal)}</p>
            </Link>
          </div>

          <Card className="mt-3 divide-y divide-line !p-0">
            <Row
              href="/perfumes"
              icon={Flower2}
              title="Perfume de hoje"
              value={data.perfumeToday ?? (data.hasPerfumes ? 'Registrar' : 'Montar coleção')}
              muted={!data.perfumeToday}
            />
            <Row href="/dieta" icon={Droplet} title="Água" value={`${data.water} de ${me.daily_water_goal} copos`} />
            <Row href="/dieta" icon={UtensilsCrossed} title="Refeições" value={data.mealsToday ? `${data.mealsToday} registradas` : 'Nenhuma ainda'} muted={!data.mealsToday} />
            {data.dueCards > 0 && <Row href="/estudos" icon={Timer} title="Vocabulário" value={`${data.dueCards} para revisar`} />}
          </Card>

          {/* Pendências */}
          <SectionTitle action={<TextLink href="/atividades">Ver todas</TextLink>}>Pendências</SectionTitle>
          {data.activities.length === 0 ? (
            <p className="text-sm text-muted">Nada pendente para hoje.</p>
          ) : (
            <Card className="divide-y divide-line !py-0">
              {data.activities.slice(0, 6).map((a) => {
                const late = a.due_on && a.due_on < isoDay()
                return (
                  <div key={a.id} className="flex items-center gap-3.5 py-3.5">
                    <button
                      onClick={() => completeActivity(a)}
                      aria-label="Concluir"
                      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-faint transition hover:border-ink"
                    />
                    <p className="min-w-0 flex-1 truncate">{a.title}</p>
                    <span className={cx('num shrink-0 text-xs', late ? 'font-medium text-bad' : 'text-muted')}>
                      {late ? 'Atrasada' : a.due_time ? a.due_time.slice(0, 5) : a.due_on ? 'Hoje' : ''}
                    </span>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      )}
    </>
  )
}

function Row({ href, icon: Icon, title, value, muted }: { href: string; icon: typeof Flower2; title: string; value: string; muted?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-paper/60">
      <Icon size={18} strokeWidth={1.6} className="shrink-0 text-muted" />
      <span className="flex-1 text-[15px]">{title}</span>
      <span className={cx('truncate text-sm', muted ? 'text-faint' : 'font-medium text-ink')}>{value}</span>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </Link>
  )
}
