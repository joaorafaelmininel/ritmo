'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonMark, PersonPicker, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Choice, EmptyState, ErrorNote, Fab, Field, Input, Label, PageHeader, SectionTitle, Segmented, Sheet, Spinner, Textarea, cx } from '@/components/ui'
import { ACTIVITY_CATEGORIES } from '@/lib/constants'
import { addDays, friendlyDay, isoDay } from '@/lib/format'
import type { Activity } from '@/lib/types'

type Filter = 'todas' | 'minhas' | 'feitas'

export default function AtividadesPage() {
  const { me } = useHousehold()
  const toast = useToast()
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [filter, setFilter] = useState<Filter>('todas')
  const [editing, setEditing] = useState<Activity | 'nova' | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from('activities')
      .select('*')
      .order('done')
      .order('due_on', { ascending: true, nullsFirst: false })
      .order('due_time', { ascending: true, nullsFirst: false })
      .limit(300)
    setActivities(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => {
    const list = (activities ?? []).filter((a) => {
      if (filter === 'feitas') return a.done
      if (a.done) return false
      if (filter === 'minhas') return a.assigned_to === me.id || a.assigned_to === null
      return true
    })
    if (filter === 'feitas') return [{ title: 'Concluídas', items: list.slice(0, 50) }]
    const today = isoDay()
    const weekEnd = addDays(today, 7)
    return [
      { title: 'Atrasadas', items: list.filter((a) => a.due_on && a.due_on < today) },
      { title: 'Hoje', items: list.filter((a) => a.due_on === today) },
      { title: 'Próximos 7 dias', items: list.filter((a) => a.due_on && a.due_on > today && a.due_on <= weekEnd) },
      { title: 'Mais adiante', items: list.filter((a) => a.due_on && a.due_on > weekEnd) },
      { title: 'Sem data', items: list.filter((a) => !a.due_on) },
    ].filter((g) => g.items.length)
  }, [activities, filter, me.id])

  async function toggle(a: Activity) {
    const done = !a.done
    setActivities((list) => list?.map((x) => (x.id === a.id ? { ...x, done } : x)) ?? null)
    await supabaseBrowser()
      .from('activities')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', a.id)
    if (done) toast('Concluída')
  }

  if (!activities) return <Spinner />

  return (
    <>
      <PageHeader eyebrow="Agenda" title="Atividades" back="/mais" />
      <Segmented
        options={[
          { value: 'todas', label: 'Pendentes' },
          { value: 'minhas', label: 'Minhas' },
          { value: 'feitas', label: 'Concluídas' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={ListChecks} title="Nada pendente" text="Registre compromissos, tarefas da casa, consultas e datas importantes." />
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.title}>
            <SectionTitle>
              <span className={cx(g.title === 'Atrasadas' && 'text-bad')}>
                {g.title} · {g.items.length}
              </span>
            </SectionTitle>
            <Card className="divide-y divide-line !py-0">
              {g.items.map((a) => {
                const cat = ACTIVITY_CATEGORIES.find((c) => c.value === a.category)
                return (
                  <div key={a.id} className="flex items-center gap-3.5 py-3.5">
                    <button
                      onClick={() => toggle(a)}
                      aria-label={a.done ? 'Reabrir' : 'Concluir'}
                      className={cx(
                        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition',
                        a.done ? 'border-good bg-good text-white' : 'border-faint hover:border-ink',
                      )}
                    >
                      {a.done && <Check size={13} strokeWidth={3} />}
                    </button>
                    <button onClick={() => setEditing(a)} className="min-w-0 flex-1 text-left">
                      <p className={cx('truncate', a.done && 'text-faint line-through')}>{a.title}</p>
                      <p className="num truncate text-xs text-muted">
                        {[cat?.label, a.due_on && friendlyDay(a.due_on), a.due_time?.slice(0, 5)].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                    <PersonMark id={a.assigned_to} size={22} />
                  </div>
                )
              })}
            </Card>
          </div>
        ))
      )}

      <ActivitySheet
        activity={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
      <Fab onClick={() => setEditing('nova')} label="Atividade" />
    </>
  )
}

function ActivitySheet({ activity, onClose, onSaved }: { activity: Activity | 'nova' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('casa')
  const [dueOn, setDueOn] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isNew = activity === 'nova'

  useEffect(() => {
    const a = activity && activity !== 'nova' ? activity : null
    setTitle(a?.title ?? '')
    setNotes(a?.notes ?? '')
    setCategory(a?.category ?? 'casa')
    setDueOn(a?.due_on ?? (activity === 'nova' ? isoDay() : ''))
    setDueTime(a?.due_time?.slice(0, 5) ?? '')
    setAssignedTo(a?.assigned_to ?? null)
    setError(null)
  }, [activity])

  async function save() {
    if (!title.trim()) return setError('Descreva a atividade.')
    const data = {
      title: title.trim(),
      notes: notes.trim() || null,
      category,
      due_on: dueOn || null,
      due_time: dueTime || null,
      assigned_to: assignedTo,
    }
    const supabase = supabaseBrowser()
    const { error } = isNew ? await supabase.from('activities').insert(data) : await supabase.from('activities').update(data).eq('id', (activity as Activity).id)
    if (error) return setError(error.message)
    toast(isNew ? 'Atividade criada' : 'Atividade atualizada')
    onSaved()
  }

  async function remove() {
    if (!activity || activity === 'nova' || !confirm('Excluir esta atividade?')) return
    await supabaseBrowser().from('activities').delete().eq('id', activity.id)
    onSaved()
  }

  return (
    <Sheet open={!!activity} onClose={onClose} title={isNew ? 'Nova atividade' : 'Editar atividade'}>
      <div className="space-y-6">
        <Field label="O que precisa ser feito">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Levar o carro na revisão" autoFocus={isNew} />
        </Field>
        <div>
          <Label>Categoria</Label>
          <Choice options={ACTIVITY_CATEGORIES} value={category} onChange={setCategory} columns={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </Field>
          <Field label="Horário">
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </Field>
        </div>
        <div>
          <Label>Responsável</Label>
          <PersonPicker value={assignedTo} onChange={setAssignedTo} allowBoth />
        </div>
        <Field label="Detalhes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </Field>
        <ErrorNote message={error} />
        <Button block size="lg" onClick={save}>
          Salvar
        </Button>
        {!isNew && (
          <Button block variant="danger" onClick={remove}>
            Excluir atividade
          </Button>
        )}
      </div>
    </Sheet>
  )
}
