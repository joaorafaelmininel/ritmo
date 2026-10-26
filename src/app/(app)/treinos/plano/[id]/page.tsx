'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonPicker, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, ErrorNote, Field, Input, PageHeader, SectionTitle, Spinner, Textarea, cx } from '@/components/ui'
import { WEEKDAYS } from '@/lib/constants'

type DraftExercise = {
  key: string
  name: string
  sets: string
  reps: string
  load: string
  rest_seconds: string
  notes: string
}

const PLAN_EMOJIS = ['💪', '🏋️‍♀️', '🧘‍♀️', '🏃‍♀️', '🚴‍♀️', '🤸‍♀️', '🏊‍♀️', '🔥', '🦵', '🍑']

const blankExercise = (): DraftExercise => ({
  key: Math.random().toString(36).slice(2),
  name: '',
  sets: '3',
  reps: '12',
  load: '',
  rest_seconds: '60',
  notes: '',
})

export default function PlanEditorPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'novo'
  const router = useRouter()
  const toast = useToast()
  const { me, partner } = useHousehold()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('💪')
  const [assignedTo, setAssignedTo] = useState<string | null>(partner?.id ?? me.id)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [exercises, setExercises] = useState<DraftExercise[]>([blankExercise()])

  useEffect(() => {
    if (isNew) return
    supabaseBrowser()
      .from('workout_plans')
      .select('*, plan_exercises(*)')
      .eq('id', params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name)
          setDescription(data.description ?? '')
          setEmoji(data.emoji)
          setAssignedTo(data.assigned_to)
          setWeekdays(data.weekdays ?? [])
          const list = (data.plan_exercises ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position)
          setExercises(
            list.length
              ? list.map((e: Record<string, unknown>) => ({
                  key: String(e.id),
                  name: String(e.name ?? ''),
                  sets: e.sets == null ? '' : String(e.sets),
                  reps: String(e.reps ?? ''),
                  load: String(e.load ?? ''),
                  rest_seconds: e.rest_seconds == null ? '' : String(e.rest_seconds),
                  notes: String(e.notes ?? ''),
                }))
              : [blankExercise()],
          )
        }
        setLoading(false)
      })
  }, [isNew, params.id])

  function update(key: string, patch: Partial<DraftExercise>) {
    setExercises((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  function move(index: number, delta: number) {
    setExercises((list) => {
      const next = [...list]
      const target = index + delta
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save() {
    const valid = exercises.filter((e) => e.name.trim())
    if (!name.trim()) return setError('Dê um nome para o treino.')
    if (valid.length === 0) return setError('Inclua pelo menos um exercício.')
    setSaving(true)
    setError(null)
    const supabase = supabaseBrowser()
    const planData = { name: name.trim(), description: description.trim() || null, emoji, assigned_to: assignedTo, weekdays }

    let planId = params.id
    if (isNew) {
      const { data, error } = await supabase.from('workout_plans').insert(planData).select('id').single()
      if (error || !data) {
        setSaving(false)
        return setError(error?.message ?? 'Não foi possível salvar.')
      }
      planId = data.id
    } else {
      const { error } = await supabase.from('workout_plans').update(planData).eq('id', planId)
      if (error) {
        setSaving(false)
        return setError(error.message)
      }
      await supabase.from('plan_exercises').delete().eq('plan_id', planId)
    }

    const toNumber = (v: string) => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v))
    const { error: exError } = await supabase.from('plan_exercises').insert(
      valid.map((e, i) => ({
        plan_id: planId,
        position: i,
        name: e.name.trim(),
        sets: toNumber(e.sets),
        reps: e.reps.trim() || null,
        load: e.load.trim() || null,
        rest_seconds: toNumber(e.rest_seconds),
        notes: e.notes.trim() || null,
      })),
    )
    setSaving(false)
    if (exError) return setError(exError.message)
    toast('Treino salvo 💪')
    router.push('/treinos')
  }

  async function archive() {
    if (!confirm('Arquivar este treino? O histórico continua salvo.')) return
    await supabaseBrowser().from('workout_plans').update({ archived: true }).eq('id', params.id)
    toast('Treino arquivado')
    router.push('/treinos')
  }

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader title={isNew ? 'Novo treino' : 'Editar treino'} back="/treinos" />

      <div className="space-y-4">
        <Field label="Nome do treino">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Inferiores + glúteo" />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-tinta/80">Ícone</span>
          <div className="flex flex-wrap gap-2">
            {PLAN_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cx('h-11 w-11 rounded-xl text-xl', emoji === e ? 'bg-ameixa-100 ring-2 ring-ameixa-500' : 'bg-white shadow-suave')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-tinta/80">Para quem?</span>
          <PersonPicker value={assignedTo} onChange={setAssignedTo} allowBoth />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-tinta/80">Dias da semana</span>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((label, day) => {
              const active = weekdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setWeekdays((w) => (active ? w.filter((d) => d !== day) : [...w, day].sort()))}
                  className={cx('h-11 rounded-xl text-xs font-bold', active ? 'bg-ameixa-600 text-white' : 'bg-white text-tinta/60 shadow-suave')}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Observações (opcional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aquecimento, foco do treino, recados…" />
        </Field>
      </div>

      <SectionTitle>Exercícios</SectionTitle>
      <div className="space-y-3">
        {exercises.map((ex, i) => (
          <Card key={ex.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ameixa-50 text-sm font-bold text-ameixa-700">{i + 1}</span>
              <Input value={ex.name} onChange={(e) => update(ex.key, { name: e.target.value })} placeholder="Nome do exercício" className="!py-2.5" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MiniField label="Séries" value={ex.sets} onChange={(v) => update(ex.key, { sets: v })} inputMode="numeric" />
              <MiniField label="Reps" value={ex.reps} onChange={(v) => update(ex.key, { reps: v })} />
              <MiniField label="Carga" value={ex.load} onChange={(v) => update(ex.key, { load: v })} placeholder="kg" />
              <MiniField label="Desc. (s)" value={ex.rest_seconds} onChange={(v) => update(ex.key, { rest_seconds: v })} inputMode="numeric" />
            </div>
            <Input value={ex.notes} onChange={(e) => update(ex.key, { notes: e.target.value })} placeholder="Dica de execução (opcional)" className="!py-2.5 text-sm" />
            <div className="flex justify-end gap-1 text-sm">
              <button type="button" onClick={() => move(i, -1)} className="rounded-lg px-3 py-1.5 text-tinta/50 hover:bg-black/5" aria-label="Subir">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="rounded-lg px-3 py-1.5 text-tinta/50 hover:bg-black/5" aria-label="Descer">↓</button>
              <button
                type="button"
                onClick={() => setExercises((list) => (list.length > 1 ? list.filter((e) => e.key !== ex.key) : list))}
                className="rounded-lg px-3 py-1.5 font-semibold text-rosa-500 hover:bg-rosa-100"
              >
                Remover
              </button>
            </div>
          </Card>
        ))}
        <Button variant="soft" block onClick={() => setExercises((list) => [...list, blankExercise()])}>
          + Adicionar exercício
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        <ErrorNote message={error} />
        <Button block onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar treino'}
        </Button>
        {!isNew && (
          <Button block variant="ghost" onClick={archive}>
            Arquivar treino
          </Button>
        )}
      </div>
    </>
  )
}

function MiniField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric'
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-tinta/50">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-center outline-none focus:border-ameixa-500"
      />
    </label>
  )
}
