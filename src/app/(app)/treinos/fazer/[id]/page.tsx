'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { Check, Flag, Minus, Play, Timer } from 'lucide-react'
import { Button, Card, Chips, Choice, ErrorNote, Field, Input, Metric, PageHeader, Progress, Scale, Spinner, Textarea, cx } from '@/components/ui'
import { COMPLETION_OPTIONS, EFFORT_LEVELS, MOODS } from '@/lib/constants'
import type { Completion, PlanExercise, WorkoutPlan } from '@/lib/types'

type RunState = {
  startedAt: number
  sets: Record<string, number>
  skipped: string[]
  notes: Record<string, string>
  current: number
}

type Step = 'intro' | 'treino' | 'feedback' | 'pronto'

function storageKey(planId: string) {
  return `treino-em-andamento:${planId}`
}

function loadProgress(planId: string): RunState | null {
  try {
    const raw = localStorage.getItem(storageKey(planId))
    return raw ? (JSON.parse(raw) as RunState) : null
  } catch {
    return null
  }
}

function saveProgress(planId: string, progress: RunState | null) {
  try {
    if (progress) localStorage.setItem(storageKey(planId), JSON.stringify(progress))
    else localStorage.removeItem(storageKey(planId))
  } catch {
    // armazenamento indisponível: o treino segue só na memória
  }
}

function clock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function FazerTreinoPage({ params }: { params: { id: string } }) {
  const { me } = useHousehold()
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [step, setStep] = useState<Step>('intro')
  const [progress, setProgress] = useState<RunState | null>(null)
  const [now, setNow] = useState(Date.now())
  const [restUntil, setRestUntil] = useState<number | null>(null)

  // Perguntas do final
  const [completion, setCompletion] = useState<Completion | null>(null)
  const [effort, setEffort] = useState<number | null>(null)
  const [mood, setMood] = useState<string | null>(null)
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseBrowser()
      .from('workout_plans')
      .select('*, plan_exercises(*)')
      .eq('id', params.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        data.plan_exercises?.sort((a: PlanExercise, b: PlanExercise) => a.position - b.position)
        setPlan(data)
        const saved = loadProgress(params.id)
        if (saved) {
          setProgress(saved)
          setStep('treino')
        }
      })
  }, [params.id])

  useEffect(() => {
    if (step !== 'treino') return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [step])

  useEffect(() => {
    if (progress && step === 'treino') saveProgress(params.id, progress)
  }, [progress, step, params.id])

  const exercises = useMemo(() => plan?.plan_exercises ?? [], [plan])

  const isDone = (ex: PlanExercise) => (progress?.sets[ex.id] ?? 0) >= (ex.sets ?? 1)
  const doneCount = exercises.filter(isDone).length
  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0

  const restEndedRef = useRef(false)
  useEffect(() => {
    if (restUntil && restLeft === 0 && !restEndedRef.current) {
      restEndedRef.current = true
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {}
    }
  }, [restLeft, restUntil])

  if (!plan) return <Spinner />

  function start() {
    const fresh: RunState = { startedAt: Date.now(), sets: {}, skipped: [], notes: {}, current: 0 }
    setProgress(fresh)
    setNow(Date.now())
    setStep('treino')
  }

  function nextPending(from: number, p: RunState) {
    for (let i = 1; i <= exercises.length; i++) {
      const idx = (from + i) % exercises.length
      const ex = exercises[idx]
      if ((p.sets[ex.id] ?? 0) < (ex.sets ?? 1) && !p.skipped.includes(ex.id)) return idx
    }
    return from
  }

  function tapSet(ex: PlanExercise, index: number) {
    if (!progress) return
    const current = progress.sets[ex.id] ?? 0
    const total = ex.sets ?? 1
    // tocar numa série já feita desfaz até ela
    const value = index < current ? index : index + 1
    const next: RunState = { ...progress, sets: { ...progress.sets, [ex.id]: value }, skipped: progress.skipped.filter((s) => s !== ex.id) }
    if (value > current && ex.rest_seconds && value < total) {
      restEndedRef.current = false
      setRestUntil(Date.now() + ex.rest_seconds * 1000)
    } else {
      setRestUntil(null)
    }
    if (value >= total) next.current = nextPending(exercises.indexOf(ex), next)
    setProgress(next)
  }

  function completeExercise(ex: PlanExercise) {
    if (!progress) return
    const next: RunState = { ...progress, sets: { ...progress.sets, [ex.id]: ex.sets ?? 1 }, skipped: progress.skipped.filter((s) => s !== ex.id) }
    next.current = nextPending(exercises.indexOf(ex), next)
    setRestUntil(null)
    setProgress(next)
  }

  function skipExercise(ex: PlanExercise) {
    if (!progress) return
    const next: RunState = { ...progress, skipped: [...progress.skipped.filter((s) => s !== ex.id), ex.id] }
    next.current = nextPending(exercises.indexOf(ex), next)
    setRestUntil(null)
    setProgress(next)
  }

  function goToFeedback() {
    if (!progress) return
    const elapsed = Math.max(1, Math.round((Date.now() - progress.startedAt) / 60000))
    setMinutes(String(elapsed))
    setCompletion(doneCount === exercises.length ? 'completo' : doneCount === 0 ? 'nao' : 'parcial')
    setRestUntil(null)
    setStep('feedback')
  }

  function cancel() {
    if (!confirm('Descartar este treino? Nada será salvo.')) return
    saveProgress(params.id, null)
    setProgress(null)
    setStep('intro')
  }

  async function finish() {
    if (!progress || !plan) return
    if (!completion) return setError('Indique se o treino foi realizado.')
    if (!effort) return setError('Indique quanto o treino cansou.')
    setSaving(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { data: session, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: me.id,
        plan_id: plan.id,
        plan_name: plan.name,
        started_at: new Date(progress.startedAt).toISOString(),
        finished_at: new Date().toISOString(),
        duration_minutes: Number(minutes) || null,
        completion,
        effort,
        mood,
        feeling_note: note.trim() || null,
      })
      .select('id')
      .single()
    if (error || !session) {
      setSaving(false)
      return setError(error?.message ?? 'Não foi possível salvar.')
    }
    await supabase.from('session_exercises').insert(
      exercises.map((ex, i) => ({
        session_id: session.id,
        position: i,
        exercise_name: ex.name,
        planned: [ex.sets && `${ex.sets}x`, ex.reps, ex.load && `· ${ex.load}`].filter(Boolean).join(' ') || null,
        done: isDone(ex),
        note: progress.notes[ex.id]?.trim() || null,
      })),
    )
    saveProgress(params.id, null)
    setSaving(false)
    setStep('pronto')
  }

  // ---------------------------------------------------------------
  if (step === 'intro') {
    return (
      <>
        <PageHeader eyebrow="Treino" title={plan.name} subtitle={`${exercises.length} exercícios`} back="/treinos" />
        {plan.description && <p className="-mt-2 mb-6 border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-soft">{plan.description}</p>}
        <Card className="divide-y divide-line !py-0">
          {exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-baseline gap-4 py-3.5">
              <span className="figure w-6 shrink-0 text-xl text-faint">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <p className="font-medium">{ex.name}</p>
                <p className="num mt-0.5 text-sm text-muted">{describe(ex)}</p>
              </div>
            </div>
          ))}
        </Card>
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-6">
          <Button block size="lg" variant="accent" icon={Play} onClick={start}>
            Iniciar treino
          </Button>
        </div>
      </>
    )
  }

  if (step === 'treino' && progress) {
    const elapsed = Math.floor((now - progress.startedAt) / 1000)
    return (
      <>
        <div className="sticky top-0 z-20 -mx-5 mb-5 border-b border-line bg-paper/95 px-5 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-end justify-between">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-muted">{plan.name}</p>
              <p className="figure mt-1 text-[44px] leading-none">{clock(elapsed)}</p>
            </div>
            <div className="text-right">
              <p className="figure text-[28px] leading-none">
                {doneCount}
                <span className="text-faint">/{exercises.length}</span>
              </p>
              <p className="mt-1 text-xs text-muted">exercícios</p>
            </div>
          </div>
          <Progress value={doneCount / Math.max(1, exercises.length)} tone="accent" className="mt-4" />
          {restUntil && (
            <div className={cx('mt-3 flex items-center justify-between rounded-xl px-4 py-3', restLeft > 0 ? 'bg-ink text-paper' : 'bg-good text-white')}>
              <span className="flex items-center gap-2 text-sm font-medium">
                <Timer size={16} strokeWidth={1.75} />
                {restLeft > 0 ? (
                  <>
                    Descanso <span className="figure text-xl leading-none">{clock(restLeft)}</span>
                  </>
                ) : (
                  'Próxima série'
                )}
              </span>
              <button className="text-sm font-medium opacity-80 hover:opacity-100" onClick={() => setRestUntil(null)}>
                {restLeft > 0 ? 'Pular' : 'Ok'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {exercises.map((ex, i) => {
            const done = isDone(ex)
            const skipped = progress.skipped.includes(ex.id)
            const open = i === progress.current
            const setsDone = progress.sets[ex.id] ?? 0
            const total = ex.sets ?? 1
            return (
              <Card
                key={ex.id}
                className={cx('transition', open ? 'border-ink' : 'hover:border-faint', (done || skipped) && !open && 'opacity-55')}
                onClick={open ? undefined : () => setProgress({ ...progress, current: i })}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={cx(
                      'num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                      done ? 'bg-good text-white' : skipped ? 'bg-sunken text-faint' : open ? 'bg-ink text-paper' : 'border border-line text-muted',
                    )}
                  >
                    {done ? <Check size={15} strokeWidth={2.5} /> : skipped ? <Minus size={15} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('font-medium', done && 'line-through decoration-faint')}>{ex.name}</p>
                    <p className="num text-sm text-muted">{describe(ex)}</p>
                  </div>
                </div>

                {open && (
                  <div className="mt-5 space-y-4">
                    {ex.notes && <p className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-soft">{ex.notes}</p>}
                    <div>
                      <p className="mb-2 text-xs text-muted">Toque em cada série ao concluir</p>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: total }, (_, s) => (
                          <button
                            key={s}
                            onClick={() => tapSet(ex, s)}
                            className={cx(
                              'flex aspect-square flex-col items-center justify-center rounded-xl border text-[15px] font-medium transition active:scale-95',
                              s < setsDone ? 'border-good bg-good text-white' : 'border-line bg-paper text-ink',
                            )}
                          >
                            {s < setsDone ? <Check size={18} strokeWidth={2.25} /> : <span className="num">{s + 1}</span>}
                            {ex.reps && <span className={cx('num text-2xs', s < setsDone ? 'text-white/80' : 'text-muted')}>{ex.reps}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      placeholder="Anotação: aumentei a carga, senti o joelho…"
                      value={progress.notes[ex.id] ?? ''}
                      onChange={(e) => setProgress({ ...progress, notes: { ...progress.notes, [ex.id]: e.target.value } })}
                      className="!py-2.5 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => skipExercise(ex)}>
                        Pular
                      </Button>
                      <Button onClick={() => completeExercise(ex)} disabled={done}>
                        Concluir
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        <div className="mt-8 space-y-2">
          <Button block size="lg" variant="accent" icon={Flag} onClick={goToFeedback}>
            Finalizar treino
          </Button>
          <Button block variant="ghost" onClick={cancel}>
            Descartar
          </Button>
        </div>
      </>
    )
  }

  if (step === 'feedback') {
    return (
      <>
        <PageHeader eyebrow={plan.name} title="Como foi?" subtitle="Quatro respostas rápidas para acompanhar a evolução." />
        <div className="space-y-8">
          <Question n={1} title="Você realizou o treino?">
            <Choice options={COMPLETION_OPTIONS} value={completion} onChange={setCompletion} />
          </Question>
          <Question n={2} title="Quanto cansou?">
            <Scale options={EFFORT_LEVELS} value={effort} onChange={setEffort} />
          </Question>
          <Question n={3} title="Como você está se sentindo?">
            <Chips options={MOODS} value={mood} onChange={setMood} wrap />
          </Question>
          <Question n={4} title="Quanto tempo levou?">
            <div className="flex items-center gap-3">
              <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} className="figure !w-28 text-center !text-2xl" />
              <span className="text-sm text-muted">minutos · calculado pelo cronômetro</span>
            </div>
          </Question>
          <Field label="Observações (opcional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: rendeu muito hoje, senti a lombar no agachamento…" />
          </Field>
          <ErrorNote message={error} />
          <div className="space-y-2">
            <Button block size="lg" onClick={finish} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar treino'}
            </Button>
            <Button block variant="ghost" onClick={() => setStep('treino')}>
              Voltar ao treino
            </Button>
          </div>
        </div>
      </>
    )
  }

  // pronto
  const effortInfo = EFFORT_LEVELS.find((e) => e.value === effort)
  return (
    <div className="flex min-h-[75dvh] animate-rise flex-col justify-center">
      <span className={cx('flex h-14 w-14 items-center justify-center rounded-full text-white', completion === 'nao' ? 'bg-ink' : 'bg-good')}>
        <Check size={26} strokeWidth={2.25} />
      </span>
      <h1 className="mt-6 font-serif text-[36px] leading-[1.08]">{completion === 'nao' ? 'Registrado. Amanhã tem mais.' : 'Treino concluído.'}</h1>
      <dl className="mt-8 grid grid-cols-3 divide-x divide-line border-y border-line py-4">
        <Metric className="px-3 first:pl-0" label="Exercícios" value={`${doneCount}/${exercises.length}`} />
        <Metric className="px-3" label="Duração" value={`${minutes}′`} />
        <Metric className="px-3" label="Esforço" value={effortInfo ? `${effortInfo.value}/5` : '—'} />
      </dl>
      <div className="mt-10 space-y-2">
        <Link href="/treinos" className="block">
          <Button block size="lg">
            Voltar aos treinos
          </Button>
        </Link>
        <Link href="/" className="block">
          <Button block variant="ghost">
            Ir para Hoje
          </Button>
        </Link>
      </div>
    </div>
  )
}

function Question({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="figure text-lg text-accent">{String(n).padStart(2, '0')}</span>
        <h2 className="text-[17px] font-medium">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function describe(ex: PlanExercise) {
  return (
    [ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.sets ? `${ex.sets} séries` : ex.reps, ex.load, ex.rest_seconds && `pausa ${ex.rest_seconds}s`]
      .filter(Boolean)
      .join(' · ') || 'Livre'
  )
}
