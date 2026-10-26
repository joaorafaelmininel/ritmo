'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { Button, Card, Choice, ErrorNote, Field, Input, PageHeader, Progress, Spinner, Textarea, cx } from '@/components/ui'
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
    if (!completion) return setError('Conta pra gente se conseguiu fazer o treino.')
    if (!effort) return setError('Quanto cansou? Escolha uma opção.')
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
        <PageHeader title={`${plan.emoji} ${plan.name}`} subtitle={`${exercises.length} exercícios`} back="/treinos" />
        {plan.description && <Card className="mb-4 text-sm text-tinta/70">📝 {plan.description}</Card>}
        <div className="space-y-2">
          {exercises.map((ex, i) => (
            <Card key={ex.id} className="!p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ameixa-50 text-sm font-bold text-ameixa-700">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-semibold">{ex.name}</p>
                  <p className="text-xs text-tinta/55">{describe(ex)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-6">
          <Button block onClick={start} className="!min-h-[56px] text-lg">
            ▶ Começar agora
          </Button>
        </div>
      </>
    )
  }

  if (step === 'treino' && progress) {
    const elapsed = Math.floor((now - progress.startedAt) / 1000)
    return (
      <>
        <div className="sticky top-0 z-20 -mx-4 mb-4 bg-creme/95 px-4 pb-3 pt-2 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-tinta/60">
                {plan.emoji} {plan.name}
              </p>
              <p className="font-mono text-3xl font-extrabold tabular-nums">{clock(elapsed)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold">
                {doneCount}/{exercises.length}
              </p>
              <p className="text-xs text-tinta/50">exercícios</p>
            </div>
          </div>
          <Progress value={doneCount / Math.max(1, exercises.length)} className="mt-2" />
          {restUntil && (
            <div className={cx('mt-3 flex items-center justify-between rounded-2xl px-4 py-3', restLeft > 0 ? 'bg-ceu-100 text-ceu-500' : 'bg-salvia-100 text-salvia-500')}>
              <span className="font-bold">{restLeft > 0 ? `⏳ Descanso: ${clock(restLeft)}` : '🔔 Bora pra próxima série!'}</span>
              <button className="text-sm font-semibold underline" onClick={() => setRestUntil(null)}>
                {restLeft > 0 ? 'Pular' : 'Ok'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {exercises.map((ex, i) => {
            const done = isDone(ex)
            const skipped = progress.skipped.includes(ex.id)
            const open = i === progress.current
            const setsDone = progress.sets[ex.id] ?? 0
            const total = ex.sets ?? 1
            return (
              <Card
                key={ex.id}
                className={cx(open && 'ring-2 ring-ameixa-500', (done || skipped) && !open && 'opacity-60')}
                onClick={open ? undefined : () => setProgress({ ...progress, current: i })}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      done ? 'bg-salvia-500 text-white' : skipped ? 'bg-black/10 text-tinta/50' : 'bg-ameixa-50 text-ameixa-700',
                    )}
                  >
                    {done ? '✓' : skipped ? '–' : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('font-bold', done && 'line-through decoration-2')}>{ex.name}</p>
                    <p className="text-xs text-tinta/55">{describe(ex)}</p>
                  </div>
                </div>

                {open && (
                  <div className="mt-4 space-y-4">
                    {ex.notes && <p className="rounded-xl bg-mel-100 px-3 py-2 text-sm text-tinta/80">💡 {ex.notes}</p>}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-tinta/50">Toque em cada série ao terminar</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: total }, (_, s) => (
                          <button
                            key={s}
                            onClick={() => tapSet(ex, s)}
                            className={cx(
                              'flex h-14 w-14 flex-col items-center justify-center rounded-2xl text-sm font-bold transition active:scale-90',
                              s < setsDone ? 'bg-salvia-500 text-white animate-pop' : 'bg-ameixa-50 text-ameixa-700',
                            )}
                          >
                            {s < setsDone ? '✓' : s + 1}
                            <span className="text-[10px] font-medium opacity-80">{ex.reps ?? ''}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      placeholder="Anotação (ex.: subi a carga, senti o joelho…)"
                      value={progress.notes[ex.id] ?? ''}
                      onChange={(e) => setProgress({ ...progress, notes: { ...progress.notes, [ex.id]: e.target.value } })}
                      className="!py-2.5 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="ghost" onClick={() => skipExercise(ex)}>
                        Pular
                      </Button>
                      <Button variant="soft" onClick={() => completeExercise(ex)} disabled={done}>
                        ✓ Concluído
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        <div className="mt-6 space-y-2">
          <Button block onClick={goToFeedback} className="!min-h-[56px] text-lg">
            🏁 Finalizar treino
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
        <PageHeader title="Como foi o treino?" subtitle="Leva 10 segundinhos" />
        <div className="space-y-6">
          <div>
            <p className="mb-2 font-bold">Você realizou o treino?</p>
            <Choice options={COMPLETION_OPTIONS} value={completion} onChange={setCompletion} />
          </div>
          <div>
            <p className="mb-2 font-bold">Quanto cansou?</p>
            <Choice options={EFFORT_LEVELS} value={effort} onChange={setEffort} columns={5} />
          </div>
          <div>
            <p className="mb-2 font-bold">Como você está se sentindo?</p>
            <Choice options={MOODS} value={mood} onChange={setMood} columns={5} />
          </div>
          <Field label="Quanto tempo levou? (minutos)" hint="Já calculamos pelo cronômetro — ajuste se precisar.">
            <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Quer contar mais alguma coisa?">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: hoje rendeu muito! / senti a lombar no agachamento" />
          </Field>
          <ErrorNote message={error} />
          <Button block onClick={finish} disabled={saving} className="!min-h-[56px] text-lg">
            {saving ? 'Salvando…' : 'Salvar treino'}
          </Button>
          <Button block variant="ghost" onClick={() => setStep('treino')}>
            Voltar ao treino
          </Button>
        </div>
      </>
    )
  }

  // pronto
  const effortInfo = EFFORT_LEVELS.find((e) => e.value === effort)
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <span className="text-7xl animate-pop">{completion === 'nao' ? '🫶' : '🎉'}</span>
      <h1 className="mt-4 text-3xl font-extrabold">{completion === 'nao' ? 'Tudo bem, amanhã tem mais!' : 'Treino concluído!'}</h1>
      <p className="mt-2 text-tinta/60">
        {doneCount} de {exercises.length} exercícios · {minutes} min {effortInfo && `· ${effortInfo.emoji} ${effortInfo.label}`}
      </p>
      <Link href="/treinos" className="mt-8 w-full">
        <Button block>Voltar aos treinos</Button>
      </Link>
      <Link href="/" className="mt-2 w-full">
        <Button block variant="ghost">
          Ir para o início
        </Button>
      </Link>
    </div>
  )
}

function describe(ex: PlanExercise) {
  return (
    [ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.sets ? `${ex.sets} séries` : ex.reps, ex.load, ex.rest_seconds && `descanso ${ex.rest_seconds}s`]
      .filter(Boolean)
      .join(' · ') || 'Livre'
  )
}
