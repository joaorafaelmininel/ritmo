'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonSwitch, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Choice, ErrorNote, Label, PageHeader, SectionTitle, Segmented, Sheet, Textarea, cx } from '@/components/ui'
import { MEAL_FEELINGS, MEAL_TYPES } from '@/lib/constants'
import { addDays, friendlyDay, isoDay } from '@/lib/format'
import type { Meal, MealType } from '@/lib/types'

export default function DietaPage() {
  const { me, members } = useHousehold()
  const toast = useToast()
  const [person, setPerson] = useState(me.id)
  const [day, setDay] = useState(isoDay())
  const [meals, setMeals] = useState<Meal[]>([])
  const [glasses, setGlasses] = useState(0)
  const [adding, setAdding] = useState<MealType | null>(null)
  const isMe = person === me.id
  const owner = members.find((m) => m.id === person) ?? me
  const waterGoal = owner.daily_water_goal || 8

  const load = useCallback(async () => {
    const supabase = supabaseBrowser()
    const [m, w] = await Promise.all([
      supabase.from('meals').select('*').eq('user_id', person).eq('eaten_on', day).order('created_at'),
      supabase.from('water_logs').select('glasses').eq('user_id', person).eq('day', day).maybeSingle(),
    ])
    setMeals(m.data ?? [])
    setGlasses(w.data?.glasses ?? 0)
  }, [person, day])

  useEffect(() => {
    load()
  }, [load])

  async function setWater(value: number) {
    if (!isMe) return
    const v = Math.max(0, value)
    setGlasses(v)
    await supabaseBrowser().from('water_logs').upsert({ user_id: me.id, day, glasses: v }, { onConflict: 'user_id,day' })
    if (v === waterGoal) toast('Meta de água atingida')
  }

  async function remove(meal: Meal) {
    if (!confirm('Excluir esta refeição?')) return
    await supabaseBrowser().from('meals').delete().eq('id', meal.id)
    setMeals((list) => list.filter((m) => m.id !== meal.id))
  }

  const onPlan = meals.filter((m) => m.on_plan).length

  return (
    <>
      <PageHeader eyebrow="Alimentação" title="Dieta" back="/mais" />
      <PersonSwitch value={person} onChange={setPerson} />

      <div className="flex items-center justify-between">
        <button onClick={() => setDay(addDays(day, -1))} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Dia anterior">
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <p className="text-sm font-medium text-ink-soft">{friendlyDay(day)}</p>
        <button
          onClick={() => setDay(addDays(day, 1))}
          disabled={day >= isoDay()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
          aria-label="Próximo dia"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      <Card className="mt-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xs font-medium uppercase tracking-label text-muted">Hidratação</p>
            <p className="figure mt-1 text-[36px] leading-none">
              {glasses}
              <span className="text-faint">/{waterGoal}</span>
            </p>
            <p className="mt-1.5 text-xs text-muted">copos de 250 ml</p>
          </div>
          {isMe && (
            <div className="flex gap-2">
              <button onClick={() => setWater(glasses - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-soft hover:border-faint" aria-label="Menos um copo">
                <Minus size={18} strokeWidth={1.75} />
              </button>
              <button onClick={() => setWater(glasses + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper" aria-label="Mais um copo">
                <Plus size={18} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-1">
          {Array.from({ length: Math.max(waterGoal, glasses) }, (_, i) => (
            <button
              key={i}
              disabled={!isMe}
              onClick={() => setWater(i + 1 === glasses ? i : i + 1)}
              className={cx('h-7 flex-1 rounded-[5px] transition', i < glasses ? 'bg-data-slate' : 'bg-sunken')}
              aria-label={`${i + 1} copos`}
            />
          ))}
        </div>
      </Card>

      <SectionTitle>
        Refeições{meals.length > 0 && <span className="normal-case tracking-normal"> · {onPlan} de {meals.length} no plano</span>}
      </SectionTitle>
      <Card className="divide-y divide-line !py-0">
        {MEAL_TYPES.map(({ value, label, icon: Icon }) => {
          const list = meals.filter((m) => m.meal_type === value)
          return (
            <div key={value} className="py-3.5">
              <div className="flex items-center gap-3.5">
                <Icon size={18} strokeWidth={1.6} className={list.length ? 'text-ink' : 'text-faint'} />
                <p className={cx('flex-1', list.length ? 'font-medium' : 'text-muted')}>{label}</p>
                {isMe && (
                  <button onClick={() => setAdding(value)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={`Registrar ${label}`}>
                    <Plus size={18} strokeWidth={1.75} />
                  </button>
                )}
              </div>
              {list.map((m) => {
                const feeling = MEAL_FEELINGS.find((f) => f.value === m.feeling)
                return (
                  <div key={m.id} className="ml-8 mt-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-soft">{m.description}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span className={cx('h-1.5 w-1.5 rounded-full', m.on_plan ? 'bg-good' : 'bg-warn')} />
                        {m.on_plan ? 'No plano' : 'Fora do plano'}
                        {feeling && <span>· {feeling.label}</span>}
                      </p>
                    </div>
                    {isMe && (
                      <button onClick={() => remove(m)} className="p-1 text-faint hover:text-bad" aria-label="Excluir">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </Card>

      <MealSheet
        type={adding}
        day={day}
        onClose={() => setAdding(null)}
        onSaved={() => {
          setAdding(null)
          toast('Refeição registrada')
          load()
        }}
      />
    </>
  )
}

function MealSheet({ type, day, onClose, onSaved }: { type: MealType | null; day: string; onClose: () => void; onSaved: () => void }) {
  const [mealType, setMealType] = useState<MealType>('almoco')
  const [description, setDescription] = useState('')
  const [feeling, setFeeling] = useState<'otimo' | 'ok' | 'pesado' | null>(null)
  const [onPlan, setOnPlan] = useState<'sim' | 'nao'>('sim')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (type) {
      setMealType(type)
      setDescription('')
      setFeeling(null)
      setOnPlan('sim')
      setError(null)
    }
  }, [type])

  async function save() {
    if (!description.trim()) return setError('Descreva o que você comeu.')
    const { error } = await supabaseBrowser()
      .from('meals')
      .insert({ meal_type: mealType, description: description.trim(), feeling, on_plan: onPlan === 'sim', eaten_on: day })
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet open={!!type} onClose={onClose} title="Registrar refeição">
      <div className="space-y-6">
        <Choice options={MEAL_TYPES} value={mealType} onChange={setMealType} columns={3} />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: arroz, feijão, frango grelhado e salada" autoFocus />
        <div>
          <Label>Como se sentiu depois</Label>
          <Choice options={MEAL_FEELINGS} value={feeling} onChange={setFeeling} compact />
        </div>
        <div>
          <Label>Dentro do plano alimentar?</Label>
          <Segmented
            options={[
              { value: 'sim', label: 'Sim' },
              { value: 'nao', label: 'Não' },
            ]}
            value={onPlan}
            onChange={setOnPlan}
          />
        </div>
        <ErrorNote message={error} />
        <Button block size="lg" onClick={save}>
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}
