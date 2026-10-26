'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Choice, EmptyState, ErrorNote, Field, Input, PageHeader, Pills, Progress, SectionTitle, Sheet, Spinner, Stat, Textarea, cx } from '@/components/ui'
import { LANGUAGES, LEITNER_INTERVALS, MOODS, STUDY_KINDS, languageFlag, studyKind } from '@/lib/constants'
import { addDays, formatDuration, friendlyDay, isoDay, startOfWeek, weekdayShort } from '@/lib/format'
import type { StudySession, VocabCard } from '@/lib/types'

const TIMER_KEY = 'estudo-cronometro'

function readTimer(): number | null {
  try {
    const v = localStorage.getItem(TIMER_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

function writeTimer(value: number | null) {
  try {
    if (value) localStorage.setItem(TIMER_KEY, String(value))
    else localStorage.removeItem(TIMER_KEY)
  } catch {}
}

export default function EstudosPage() {
  const { me, members } = useHousehold()
  const toast = useToast()
  const [person, setPerson] = useState(me.id)
  const [sessions, setSessions] = useState<StudySession[] | null>(null)
  const [cards, setCards] = useState<VocabCard[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [prefillMinutes, setPrefillMinutes] = useState<number | null>(null)
  const [wordOpen, setWordOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [timerStart, setTimerStart] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    const supabase = supabaseBrowser()
    const [s, c] = await Promise.all([
      supabase.from('study_sessions').select('*').gte('studied_on', addDays(isoDay(), -120)).order('studied_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('vocab_cards').select('*').order('created_at', { ascending: false }),
    ])
    setSessions(s.data ?? [])
    setCards(c.data ?? [])
  }, [])

  useEffect(() => {
    load()
    setTimerStart(readTimer())
  }, [load])

  useEffect(() => {
    if (!timerStart) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [timerStart])

  const mine = useMemo(() => (sessions ?? []).filter((s) => s.user_id === person), [sessions, person])
  const myCards = useMemo(() => cards.filter((c) => c.user_id === person), [cards, person])
  const dueCards = myCards.filter((c) => c.next_review <= isoDay())
  const owner = members.find((m) => m.id === person) ?? me
  const isMe = person === me.id

  const stats = useMemo(() => {
    const weekStart = startOfWeek()
    const week = mine.filter((s) => s.studied_on >= weekStart).reduce((sum, s) => sum + s.minutes, 0)
    const days = new Set(mine.map((s) => s.studied_on))
    let streak = 0
    let cursor = days.has(isoDay()) ? isoDay() : addDays(isoDay(), -1)
    while (days.has(cursor)) {
      streak++
      cursor = addDays(cursor, -1)
    }
    const byLanguage = new Map<string, number>()
    for (const s of mine) byLanguage.set(s.language, (byLanguage.get(s.language) ?? 0) + s.minutes)
    // últimos 7 dias para o mini gráfico
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(isoDay(), i - 6)
      return { day, minutes: mine.filter((s) => s.studied_on === day).reduce((sum, s) => sum + s.minutes, 0) }
    })
    return { week, streak, byLanguage: [...byLanguage.entries()].sort((a, b) => b[1] - a[1]), last7 }
  }, [mine])

  if (!sessions) return <Spinner />

  const goal = owner.weekly_study_goal_minutes || 150
  const maxDay = Math.max(30, ...stats.last7.map((d) => d.minutes))
  const lastLanguage = mine[0]?.language ?? 'Inglês'

  function startTimer() {
    const t = Date.now()
    writeTimer(t)
    setTimerStart(t)
    setNow(t)
  }

  function stopTimer() {
    if (!timerStart) return
    const minutes = Math.max(1, Math.round((Date.now() - timerStart) / 60000))
    writeTimer(null)
    setTimerStart(null)
    setPrefillMinutes(minutes)
    setLogOpen(true)
  }

  const elapsed = timerStart ? Math.floor((now - timerStart) / 1000) : 0

  return (
    <>
      <PageHeader title="Estudos" subtitle="Idiomas e tudo o que vocês aprendem" />

      {members.length > 1 && (
        <div className="mb-4">
          <Pills options={members.map((m) => ({ value: m.id, label: `${m.avatar} ${m.display_name}` }))} value={person} onChange={setPerson} />
        </div>
      )}

      <Card className="bg-gradient-to-br from-ceu-100 to-ameixa-50">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-tinta/60">Meta da semana</p>
            <p className="text-3xl font-extrabold">
              {formatDuration(stats.week)} <span className="text-base font-semibold text-tinta/45">/ {formatDuration(goal)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl">{stats.streak > 0 ? '🔥' : '🌱'}</p>
            <p className="text-xs font-bold text-tinta/60">{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'} seguidos</p>
          </div>
        </div>
        <Progress value={stats.week / goal} className="mt-3 !bg-white/70" />
        <div className="mt-4 flex h-20 items-end justify-between gap-1.5">
          {stats.last7.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cx('w-full rounded-md', d.minutes ? 'bg-ceu-500' : 'bg-white/70')}
                style={{ height: `${Math.max(6, (d.minutes / maxDay) * 56)}px` }}
                title={`${d.minutes} min`}
              />
              <span className="text-[10px] font-semibold text-tinta/50">{d.day === isoDay() ? 'hoje' : weekdayShort(d.day)}</span>
            </div>
          ))}
        </div>
      </Card>

      {isMe && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {timerStart ? (
            <Button onClick={stopTimer} className="!min-h-[64px] col-span-2 bg-salvia-500 hover:bg-salvia-500 text-lg">
              ⏹ Parar · <span className="font-mono tabular-nums">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
            </Button>
          ) : (
            <>
              <Button onClick={startTimer} className="!min-h-[64px]">
                ⏱ Estudar agora
              </Button>
              <Button
                variant="soft"
                onClick={() => {
                  setPrefillMinutes(null)
                  setLogOpen(true)
                }}
                className="!min-h-[64px]"
              >
                ✍️ Registrar
              </Button>
            </>
          )}
        </div>
      )}

      <SectionTitle action={isMe && <button onClick={() => setWordOpen(true)} className="text-sm font-bold text-ameixa-600">+ Palavra</button>}>
        Vocabulário
      </SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-extrabold">{myCards.length} palavras</p>
            <p className="text-sm text-tinta/55">
              {dueCards.length ? `${dueCards.length} para revisar hoje` : myCards.length ? 'Tudo revisado por hoje ✨' : 'Monte seu baralho de palavras novas'}
            </p>
          </div>
          {isMe && dueCards.length > 0 && <Button onClick={() => setReviewing(true)}>Revisar</Button>}
          {isMe && myCards.length === 0 && (
            <Button variant="soft" onClick={() => setWordOpen(true)}>
              Adicionar
            </Button>
          )}
        </div>
        {myCards.length > 0 && (
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((box) => {
              const count = myCards.filter((c) => c.box === box).length
              return (
                <div key={box} className="flex-1 rounded-lg bg-ameixa-50 py-1.5 text-center">
                  <p className="text-sm font-extrabold text-ameixa-700">{count}</p>
                  <p className="text-[10px] text-tinta/50">{['Nova', 'Fraca', 'Média', 'Boa', 'Dominada'][box - 1]}</p>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {stats.byLanguage.length > 0 && (
        <>
          <SectionTitle>Por idioma (últimos 4 meses)</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {stats.byLanguage.map(([lang, minutes]) => (
              <Stat key={lang} label={`${languageFlag(lang)} ${lang}`} value={formatDuration(minutes)} tone="ceu" />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Histórico</SectionTitle>
      {mine.length === 0 ? (
        <EmptyState emoji="📚" title="Nenhum estudo registrado" text="Use o cronômetro ou registre quanto tempo estudou e de que forma." />
      ) : (
        <div className="space-y-2">
          {mine.slice(0, 30).map((s) => {
            const kind = studyKind(s.kind)
            return (
              <Card key={s.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ceu-100 text-xl">{kind.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {languageFlag(s.language)} {s.language} · {kind.label}
                    </p>
                    <p className="text-xs text-tinta/55">
                      {friendlyDay(s.studied_on)} · {formatDuration(s.minutes)} {s.mood ?? ''}
                    </p>
                    {s.note && <p className="mt-0.5 text-sm text-tinta/70">{s.note}</p>}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <LogSheet
        open={logOpen}
        defaultLanguage={lastLanguage}
        prefillMinutes={prefillMinutes}
        onClose={() => setLogOpen(false)}
        onSaved={() => {
          setLogOpen(false)
          toast('Estudo registrado 📚')
          load()
        }}
      />
      <WordSheet
        open={wordOpen}
        defaultLanguage={lastLanguage}
        onClose={() => setWordOpen(false)}
        onSaved={() => {
          toast('Palavra adicionada')
          load()
        }}
      />
      {reviewing && (
        <Review
          cards={dueCards}
          onClose={() => {
            setReviewing(false)
            load()
          }}
        />
      )}
    </>
  )
}

function LanguagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(!LANGUAGES.some((l) => l.value === value))
  return (
    <div className="space-y-2">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => {
              setCustom(false)
              onChange(l.value)
            }}
            className={cx(
              'shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold',
              !custom && value === l.value ? 'bg-tinta text-white' : 'bg-white shadow-suave',
            )}
          >
            {l.flag} {l.value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={cx('shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold', custom ? 'bg-tinta text-white' : 'bg-white shadow-suave')}
        >
          🌍 Outro
        </button>
      </div>
      {custom && <Input value={LANGUAGES.some((l) => l.value === value) ? '' : value} onChange={(e) => onChange(e.target.value)} placeholder="Qual idioma?" />}
    </div>
  )
}

function LogSheet({
  open,
  defaultLanguage,
  prefillMinutes,
  onClose,
  onSaved,
}: {
  open: boolean
  defaultLanguage: string
  prefillMinutes: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [language, setLanguage] = useState(defaultLanguage)
  const [kind, setKind] = useState('vocabulario')
  const [minutes, setMinutes] = useState('20')
  const [day, setDay] = useState(isoDay())
  const [mood, setMood] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLanguage(defaultLanguage)
    setMinutes(prefillMinutes ? String(prefillMinutes) : '20')
    setDay(isoDay())
    setMood(null)
    setNote('')
    setError(null)
  }, [open, defaultLanguage, prefillMinutes])

  async function save() {
    const m = Number(minutes)
    if (!language.trim()) return setError('Qual idioma?')
    if (!m || m <= 0) return setError('Quantos minutos?')
    const { error } = await supabaseBrowser()
      .from('study_sessions')
      .insert({ language: language.trim(), kind, minutes: m, studied_on: day, mood, note: note.trim() || null })
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar estudo">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Idioma</p>
          <LanguagePicker value={language} onChange={setLanguage} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">O que você estudou?</p>
          <Choice options={STUDY_KINDS} value={kind} onChange={setKind} columns={4} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Por quanto tempo?</p>
          <div className="flex flex-wrap items-center gap-2">
            {['10', '15', '20', '30', '45', '60'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={cx('h-11 rounded-xl px-3.5 text-sm font-bold', minutes === m ? 'bg-ameixa-600 text-white' : 'bg-white shadow-suave')}
              >
                {m} min
              </button>
            ))}
            <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} className="!w-24 text-center" aria-label="Minutos" />
          </div>
        </div>
        <Field label="Dia">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Como foi?</p>
          <Choice options={MOODS} value={mood} onChange={setMood} columns={5} size="sm" />
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que aprendeu? Ex.: past perfect, episódio 3 de Friends…" />
        <ErrorNote message={error} />
        <Button block onClick={save}>
          Salvar
        </Button>
      </div>
    </Sheet>
  )
}

function WordSheet({ open, defaultLanguage, onClose, onSaved }: { open: boolean; defaultLanguage: string; onClose: () => void; onSaved: () => void }) {
  const [language, setLanguage] = useState(defaultLanguage)
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [example, setExample] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLanguage(defaultLanguage)
      setError(null)
    }
  }, [open, defaultLanguage])

  async function save(keepOpen: boolean) {
    if (!term.trim() || !translation.trim()) return setError('Preencha a palavra e a tradução.')
    const { error } = await supabaseBrowser()
      .from('vocab_cards')
      .insert({ language, term: term.trim(), translation: translation.trim(), example: example.trim() || null })
    if (error) return setError(error.message)
    setTerm('')
    setTranslation('')
    setExample('')
    setError(null)
    onSaved()
    if (!keepOpen) onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nova palavra">
      <div className="space-y-4">
        <LanguagePicker value={language} onChange={setLanguage} />
        <Field label="Palavra ou expressão">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: to look forward to" autoCapitalize="none" />
        </Field>
        <Field label="Tradução">
          <Input value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="Ex.: estar ansiosa(o) por" />
        </Field>
        <Field label="Exemplo (opcional)">
          <Input value={example} onChange={(e) => setExample(e.target.value)} placeholder="I'm looking forward to our trip!" />
        </Field>
        <ErrorNote message={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => save(true)}>
            Salvar e outra
          </Button>
          <Button onClick={() => save(false)}>Salvar</Button>
        </div>
      </div>
    </Sheet>
  )
}

/** Revisão estilo flashcard com caixas de Leitner. */
function Review({ cards, onClose }: { cards: VocabCard[]; onClose: () => void }) {
  const [queue] = useState(() => cards.slice().sort(() => Math.random() - 0.5))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [right, setRight] = useState(0)
  const card = queue[index]

  async function answer(correct: boolean) {
    const box = correct ? Math.min(5, card.box + 1) : 1
    const next = addDays(isoDay(), LEITNER_INTERVALS[box])
    await supabaseBrowser().from('vocab_cards').update({ box, next_review: next }).eq('id', card.id)
    if (correct) setRight((r) => r + 1)
    setRevealed(false)
    setIndex((i) => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-creme px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-semibold text-tinta/50">
            Fechar
          </button>
          <span className="text-sm font-bold text-tinta/50">
            {Math.min(index + 1, queue.length)} / {queue.length}
          </span>
        </div>
        <Progress value={index / queue.length} className="mt-3" />

        {card ? (
          <>
            <button
              onClick={() => setRevealed(true)}
              className="mt-8 flex flex-1 flex-col items-center justify-center rounded-3xl bg-white p-6 text-center shadow-suave"
            >
              <p className="text-sm font-semibold text-tinta/45">
                {languageFlag(card.language)} {card.language}
              </p>
              <p className="mt-3 text-3xl font-extrabold">{card.term}</p>
              {revealed ? (
                <div className="mt-6 animate-fade">
                  <p className="text-xl font-bold text-ameixa-600">{card.translation}</p>
                  {card.example && <p className="mt-3 text-sm italic text-tinta/60">“{card.example}”</p>}
                </div>
              ) : (
                <p className="mt-6 text-sm text-tinta/40">Toque para ver a tradução</p>
              )}
            </button>
            {revealed ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="danger" onClick={() => answer(false)} className="!min-h-[60px] text-lg">
                  😬 Errei
                </Button>
                <Button onClick={() => answer(true)} className="!min-h-[60px] bg-salvia-500 text-lg hover:bg-salvia-500">
                  😎 Acertei
                </Button>
              </div>
            ) : (
              <Button block onClick={() => setRevealed(true)} className="mt-4 !min-h-[60px] text-lg" variant="soft">
                Mostrar resposta
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="animate-pop text-7xl">🏅</span>
            <p className="mt-4 text-2xl font-extrabold">Revisão concluída!</p>
            <p className="mt-1 text-tinta/60">
              Acertou {right} de {queue.length}
            </p>
            <Button className="mt-8" onClick={onClose}>
              Voltar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
