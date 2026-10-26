'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Choice, ErrorNote, PageHeader, Pills, SectionTitle, Sheet, Textarea, cx } from '@/components/ui'
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
    if (v === waterGoal) toast('Meta de água batida! 💧')
  }

  async function remove(meal: Meal) {
    if (!confirm('Excluir esta refeição?')) return
    await supabaseBrowser().from('meals').delete().eq('id', meal.id)
    setMeals((list) => list.filter((m) => m.id !== meal.id))
  }

  const onPlan = meals.filter((m) => m.on_plan).length

  return (
    <>
      <PageHeader title="Dieta" subtitle="Refeições e hidratação" back="/mais" />

      {members.length > 1 && (
        <div className="mb-4">
          <Pills options={members.map((m) => ({ value: m.id, label: `${m.avatar} ${m.display_name}` }))} value={person} onChange={setPerson} />
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-suave">
        <button onClick={() => setDay(addDays(day, -1))} className="h-10 w-10 rounded-xl text-xl hover:bg-black/5" aria-label="Dia anterior">
          ‹
        </button>
        <p className="font-bold first-letter:uppercase">{friendlyDay(day)}</p>
        <button
          onClick={() => setDay(addDays(day, 1))}
          disabled={day >= isoDay()}
          className="h-10 w-10 rounded-xl text-xl hover:bg-black/5 disabled:opacity-30"
          aria-label="Próximo dia"
        >
          ›
        </button>
      </div>

      <Card className="mt-4 bg-ceu-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-tinta/60">Água</p>
            <p className="text-2xl font-extrabold">
              {glasses} <span className="text-base font-semibold text-tinta/50">/ {waterGoal} copos</span>
            </p>
          </div>
          {isMe && (
            <div className="flex gap-2">
              <button onClick={() => setWater(glasses - 1)} className="h-11 w-11 rounded-full bg-white text-xl font-bold shadow-suave" aria-label="Menos um copo">
                −
              </button>
              <button onClick={() => setWater(glasses + 1)} className="h-11 w-11 rounded-full bg-ceu-500 text-xl font-bold text-white shadow-suave" aria-label="Mais um copo">
                +
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {Array.from({ length: Math.max(waterGoal, glasses) }, (_, i) => (
            <button key={i} onClick={() => setWater(i + 1 === glasses ? i : i + 1)} className={cx('text-2xl transition', i < glasses ? '' : 'opacity-25 grayscale')}>
              💧
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>
        Refeições {meals.length > 0 && <span className="normal-case tracking-normal">· {onPlan}/{meals.length} dentro do plano</span>}
      </SectionTitle>
      <div className="space-y-2">
        {MEAL_TYPES.map((type) => {
          const list = meals.filter((m) => m.meal_type === type.value)
          return (
            <Card key={type.value} className="!p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-salvia-100 text-xl">{type.emoji}</span>
                <p className="flex-1 font-semibold">{type.label}</p>
                {isMe && (
                  <button onClick={() => setAdding(type.value)} className="h-9 rounded-full bg-ameixa-50 px-3 text-sm font-bold text-ameixa-700">
                    + Anotar
                  </button>
                )}
              </div>
              {list.map((m) => {
                const feeling = MEAL_FEELINGS.find((f) => f.value === m.feeling)
                return (
                  <div key={m.id} className="ml-[52px] mt-2 flex items-start justify-between gap-2 border-t border-black/5 pt-2">
                    <p className="text-sm">
                      {m.description}
                      <span className="ml-1 text-xs text-tinta/50">
                        {feeling && `${feeling.emoji} `}
                        {!m.on_plan && '· fora do plano'}
                      </span>
                    </p>
                    {isMe && (
                      <button onClick={() => remove(m)} className="shrink-0 text-xs text-tinta/35" aria-label="Excluir">
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </Card>
          )
        })}
      </div>

      <MealSheet
        type={adding}
        day={day}
        onClose={() => setAdding(null)}
        onSaved={() => {
          setAdding(null)
          toast('Refeição anotada 🍽️')
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
  const [onPlan, setOnPlan] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (type) {
      setMealType(type)
      setDescription('')
      setFeeling(null)
      setOnPlan(true)
      setError(null)
    }
  }, [type])

  async function save() {
    if (!description.trim()) return setError('O que você comeu?')
    const { error } = await supabaseBrowser()
      .from('meals')
      .insert({ meal_type: mealType, description: description.trim(), feeling, on_plan: onPlan, eaten_on: day })
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet open={!!type} onClose={onClose} title="Anotar refeição">
      <div className="space-y-5">
        <Choice options={MEAL_TYPES} value={mealType} onChange={setMealType} columns={3} size="sm" />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: arroz, feijão, frango grelhado e salada" autoFocus />
        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Como se sentiu depois?</p>
          <Choice options={MEAL_FEELINGS} value={feeling} onChange={setFeeling} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setOnPlan(v)}
              className={cx('min-h-[48px] rounded-xl border-2 font-semibold', onPlan === v ? 'border-ameixa-500 bg-ameixa-50 text-ameixa-700' : 'border-transparent bg-white shadow-suave')}
            >
              {v ? '🥗 Dentro do plano' : '🍫 Escapadinha'}
            </button>
          ))}
        </div>
        <ErrorNote message={error} />
        <Button block onClick={save}>
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}
