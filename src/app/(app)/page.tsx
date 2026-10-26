'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { Card, Progress, SectionTitle, Spinner } from '@/components/ui'
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

export default function InicioPage() {
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
  const trainedToday = (data?.sessionsToday.length ?? 0) > 0

  return (
    <>
      <header className="pb-4 pt-2">
        <p className="text-sm font-semibold text-tinta/50 first-letter:uppercase">{longToday()}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {greeting()}, {me.display_name} {me.avatar}
        </h1>
        {partner && <p className="mt-0.5 text-sm text-tinta/55">Você e {partner.display_name} {partner.avatar}</p>}
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[
          { href: '/gastos/novo', emoji: '📸', label: 'Nota fiscal' },
          { href: '/perfumes', emoji: '🌸', label: 'Perfume' },
          { href: '/dieta', emoji: '🍽️', label: 'Refeição' },
          { href: '/estudos', emoji: '⏱', label: 'Estudar' },
          { href: '/atividades', emoji: '✅', label: 'Tarefa' },
        ].map((a) => (
          <Link key={a.href + a.label} href={a.href} className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold shadow-suave active:scale-95">
            <span className="text-lg">{a.emoji}</span>
            {a.label}
          </Link>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <SectionTitle>Treino de hoje</SectionTitle>
          {trainedToday ? (
            <Card className="bg-salvia-100">
              <p className="text-lg font-extrabold">🎉 Treino feito hoje!</p>
              <p className="text-sm text-tinta/60">
                {data.sessionsToday.map((s) => `${s.plan_name}${s.duration_minutes ? ` · ${formatDuration(s.duration_minutes)}` : ''}`).join(' / ')}
              </p>
            </Card>
          ) : todayPlans.length > 0 ? (
            <div className="space-y-2">
              {todayPlans.map((p) => (
                <Link key={p.id} href={`/treinos/fazer/${p.id}`}>
                  <Card className="flex items-center gap-3 bg-gradient-to-r from-ameixa-600 to-ameixa-500 text-white">
                    <span className="text-3xl">{p.emoji}</span>
                    <span className="flex-1">
                      <span className="block font-extrabold">{p.name}</span>
                      <span className="block text-sm opacity-80">Toque para começar</span>
                    </span>
                    <span className="text-2xl">▶</span>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/treinos">
              <Card>
                <p className="font-semibold">😌 Dia livre de treino</p>
                <p className="text-sm text-tinta/55">Quer treinar mesmo assim? Veja os treinos →</p>
              </Card>
            </Link>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link href="/perfumes">
              <Card className="h-full bg-rosa-100">
                <p className="text-2xl">🌸</p>
                <p className="mt-1 text-xs font-semibold text-tinta/60">Perfume de hoje</p>
                <p className="line-clamp-2 font-extrabold leading-tight">{data.perfumeToday ?? (data.hasPerfumes ? 'Qual você usou?' : 'Monte sua coleção')}</p>
              </Card>
            </Link>
            <Link href="/gastos">
              <Card className="h-full bg-mel-100">
                <p className="text-2xl">💸</p>
                <p className="mt-1 text-xs font-semibold text-tinta/60">Gastos do mês</p>
                <p className="text-xl font-extrabold tabular-nums">{money(data.monthTotal)}</p>
              </Card>
            </Link>
            <Link href="/estudos">
              <Card className="h-full bg-ceu-100">
                <p className="text-2xl">📚</p>
                <p className="mt-1 text-xs font-semibold text-tinta/60">Estudo na semana</p>
                <p className="font-extrabold">
                  {formatDuration(data.studyWeek)} <span className="text-xs font-semibold text-tinta/50">/ {formatDuration(me.weekly_study_goal_minutes)}</span>
                </p>
                <Progress value={data.studyWeek / (me.weekly_study_goal_minutes || 150)} className="mt-2 !bg-white/70" />
                {data.dueCards > 0 && <p className="mt-2 text-xs font-bold text-ceu-500">{data.dueCards} palavras para revisar</p>}
              </Card>
            </Link>
            <Link href="/dieta">
              <Card className="h-full bg-salvia-100">
                <p className="text-2xl">🥗</p>
                <p className="mt-1 text-xs font-semibold text-tinta/60">Dieta hoje</p>
                <p className="font-extrabold">
                  {data.mealsToday} {data.mealsToday === 1 ? 'refeição' : 'refeições'}
                </p>
                <p className="text-sm font-semibold text-tinta/60">
                  💧 {data.water}/{me.daily_water_goal} copos
                </p>
              </Card>
            </Link>
          </div>

          <SectionTitle action={<Link href="/atividades" className="text-sm font-bold text-ameixa-600">Ver tudo</Link>}>Para hoje</SectionTitle>
          {data.activities.length === 0 ? (
            <Card>
              <p className="text-sm text-tinta/60">✨ Nenhuma atividade pendente para hoje.</p>
            </Card>
          ) : (
            <Card className="divide-y divide-black/5 !py-1">
              {data.activities.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-3">
                  <button onClick={() => completeActivity(a)} aria-label="Concluir" className="h-7 w-7 shrink-0 rounded-full border-2 border-black/20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-xs text-tinta/50">
                      {a.due_on && a.due_on < isoDay() ? '⚠️ Atrasada' : a.due_time ? a.due_time.slice(0, 5) : a.due_on ? 'Hoje' : 'Sem data'}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  )
}
