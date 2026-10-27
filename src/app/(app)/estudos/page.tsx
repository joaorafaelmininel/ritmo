'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, PenLine, Plus, Square, Timer, X } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonSwitch, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Chips, Choice, EmptyState, ErrorNote, Field, Input, Label, Metric, PageHeader, Progress, SectionTitle, Sheet, Spinner, TextLink, Textarea, cx } from '@/components/ui'
import { LANGUAGES, LEITNER_INTERVALS, MOODS, STUDY_KINDS, languageCode, moodLabel, studyKind } from '@/lib/constants'
import { addDays, formatDuration, friendlyDay, isoDay, startOfWeek, weekdayShort } from '@/lib/format'
import type { StudySession, VocabCard } from '@/lib/types'

const TIMER_KEY = 'estudo-cronometro'
const BOX_LABELS = ['Nova', 'Fraca', 'Média', 'Boa', 'Dominada']

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

function LangBadge({ language, className }: { language: string; className?: string }) {
  return (
    <span className={cx('num inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded-full bg-accent-soft px-1.5 text-[10px] font-bold tracking-wide text-accent', className)}>
      {languageCode(language)}
    </span>
  )
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
      supabase
        .from('study_sessions')
        .select('*')
        .gte('studied_on', addDays(isoDay(), -120))
        .order('studied_on', { ascending: false })
        .order('created_at', { ascending: false }),
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
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(isoDay(), i - 6)
      return { day, minutes: mine.filter((s) => s.studied_on === day).reduce((sum, s) => sum + s.minutes, 0) }
    })
    return { week, streak, byLanguage: [...byLanguage.entries()].sort((a, b) => b[1] - a[1]), last7 }
  }, [mine])

  if (!sessions) return <Spinner />

  const goal = owner.weekly_study_goal_minutes || 150
  const maxDay = Math.max(30, ...stats.last7.map((d) => d.minutes))
  const totalLang = stats.byLanguage.reduce((s, [, m]) => s + m, 0)
  const lastLanguage = mine[0]?.language ?? 'Inglês'
  const elapsed = timerStart ? Math.floor((now - timerStart) / 1000) : 0

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

  return (
    <>
      <PageHeader eyebrow="Aprendizado" title="Estudos" />
      <PersonSwitch value={person} onChange={setPerson} />

      <Card>
        <div className="flex items-start justify-between gap-4">
          <Metric label="Esta semana" value={formatDuration(stats.week)} detail={`de ${formatDuration(goal)} planejados`} />
          <div className="text-right">
            <p className="text-[13px] font-medium text-muted">Sequência</p>
            <p className="figure mt-1 text-[30px] leading-none">{stats.streak}</p>
            <p className="mt-1.5 text-xs text-muted">{stats.streak === 1 ? 'dia' : 'dias'}</p>
          </div>
        </div>
        <Progress value={stats.week / goal} tone="accent" className="mt-4" />
        <div className="mt-6 flex h-24 items-end justify-between gap-2">
          {stats.last7.map((d) => {
            const isToday = d.day === isoDay()
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="num text-[10px] text-faint">{d.minutes || ''}</span>
                <div
                  className={cx('w-full max-w-[22px] rounded-sm', d.minutes ? (isToday ? 'bg-accent' : 'bg-ink') : 'bg-sunken')}
                  style={{ height: `${Math.max(3, (d.minutes / maxDay) * 52)}px` }}
                />
                <span className={cx('text-[10px] capitalize', isToday ? 'font-semibold text-ink' : 'text-muted')}>{weekdayShort(d.day).slice(0, 3)}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {isMe && (
        <div className="mt-3">
          {timerStart ? (
            <button onClick={stopTimer} className="flex w-full items-center justify-between rounded-2xl bg-ink px-5 py-4 text-paper transition active:scale-[0.99]">
              <span className="text-left">
                <span className="block text-[13px] font-medium text-white/70">Estudando</span>
                <span className="figure block text-[36px] leading-none">
                  {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                </span>
              </span>
              <span className="flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink">
                <Square size={12} className="fill-ink" />
                Encerrar
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={startTimer} icon={Timer} size="lg">
                Cronometrar
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon={PenLine}
                onClick={() => {
                  setPrefillMinutes(null)
                  setLogOpen(true)
                }}
              >
                Registrar
              </Button>
            </div>
          )}
        </div>
      )}

      <SectionTitle action={isMe && <TextLink onClick={() => setWordOpen(true)}>Nova palavra</TextLink>}>Vocabulário</SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="figure text-[30px] leading-none">{myCards.length}</p>
            <p className="mt-1.5 text-sm text-muted">
              {dueCards.length ? `${dueCards.length} para revisar hoje` : myCards.length ? 'Revisão em dia' : 'Nenhuma palavra cadastrada'}
            </p>
          </div>
          {isMe && dueCards.length > 0 && (
            <Button variant="accent" onClick={() => setReviewing(true)}>
              Revisar
            </Button>
          )}
          {isMe && myCards.length === 0 && (
            <Button variant="secondary" icon={Plus} onClick={() => setWordOpen(true)}>
              Adicionar
            </Button>
          )}
        </div>
        {myCards.length > 0 && (
          <div className="mt-5">
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {[1, 2, 3, 4, 5].map((box) => {
                const count = myCards.filter((c) => c.box === box).length
                return count ? <div key={box} className="h-full" style={{ flex: count, backgroundColor: `rgba(47,107,255,${0.15 + box * 0.17})` }} /> : null
              })}
            </div>
            <div className="mt-3 grid grid-cols-5 text-center">
              {[1, 2, 3, 4, 5].map((box) => (
                <div key={box}>
                  <p className="num text-sm font-medium">{myCards.filter((c) => c.box === box).length}</p>
                  <p className="text-[10px] text-muted">{BOX_LABELS[box - 1]}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {stats.byLanguage.length > 0 && (
        <>
          <SectionTitle>Idiomas · últimos 4 meses</SectionTitle>
          <Card className="space-y-3.5">
            {stats.byLanguage.map(([lang, minutes]) => (
              <div key={lang}>
                <div className="flex items-center gap-2.5 text-sm">
                  <LangBadge language={lang} />
                  <span className="flex-1 font-medium">{lang}</span>
                  <span className="num text-muted">{formatDuration(minutes)}</span>
                </div>
                <Progress value={minutes / totalLang} className="mt-2" />
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Histórico</SectionTitle>
      {mine.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum estudo registrado" text="Use o cronômetro ou registre quanto tempo estudou e de que forma." />
      ) : (
        <Card className="divide-y divide-line !py-0">
          {mine.slice(0, 30).map((s) => {
            const kind = studyKind(s.kind)
            const Icon = kind.icon
            const mood = moodLabel(s.mood)
            return (
              <div key={s.id} className="flex gap-3.5 py-3.5">
                <Icon size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">
                      {kind.label} <span className="font-normal text-muted">· {s.language}</span>
                    </p>
                    <p className="num shrink-0 text-sm font-medium">{formatDuration(s.minutes)}</p>
                  </div>
                  <p className="text-xs text-muted">
                    {friendlyDay(s.studied_on)}
                    {mood && <span className="normal-case"> · {mood}</span>}
                  </p>
                  {s.note && <p className="mt-1 text-sm text-ink-soft">{s.note}</p>}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <LogSheet
        open={logOpen}
        defaultLanguage={lastLanguage}
        prefillMinutes={prefillMinutes}
        onClose={() => setLogOpen(false)}
        onSaved={() => {
          setLogOpen(false)
          toast('Estudo registrado')
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
  const known = LANGUAGES.some((l) => l.value === value)
  const [custom, setCustom] = useState(!known)
  return (
    <div className="space-y-2">
      <Chips
        options={[...LANGUAGES.map((l) => ({ value: l.value, label: l.value })), { value: '__outro', label: 'Outro' }]}
        value={custom ? '__outro' : value}
        onChange={(v) => {
          if (v === '__outro') {
            setCustom(true)
            onChange('')
          } else {
            setCustom(false)
            onChange(v)
          }
        }}
      />
      {custom && <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Qual idioma?" />}
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
    if (!language.trim()) return setError('Informe o idioma.')
    if (!m || m <= 0) return setError('Informe quantos minutos.')
    const { error } = await supabaseBrowser()
      .from('study_sessions')
      .insert({ language: language.trim(), kind, minutes: m, studied_on: day, mood, note: note.trim() || null })
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar estudo">
      <div className="space-y-6">
        <div>
          <Label>Idioma</Label>
          <LanguagePicker value={language} onChange={setLanguage} />
        </div>
        <div>
          <Label>Atividade</Label>
          <Choice options={STUDY_KINDS} value={kind} onChange={setKind} columns={4} />
        </div>
        <div>
          <Label>Duração</Label>
          <div className="flex items-center gap-3">
            <Input
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
              className="figure !w-24 text-center !text-2xl"
              aria-label="Minutos"
            />
            <span className="text-sm text-muted">minutos</span>
          </div>
          <div className="mt-3">
            <Chips options={['10', '15', '20', '30', '45', '60'].map((m) => ({ value: m, label: `${m} min` }))} value={minutes} onChange={setMinutes} wrap />
          </div>
        </div>
        <Field label="Dia">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div>
          <Label>Como foi</Label>
          <Chips options={MOODS} value={mood} onChange={setMood} wrap />
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que você estudou? Ex.: past perfect, episódio 3 de Friends…" />
        <ErrorNote message={error} />
        <Button block size="lg" onClick={save}>
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
      <div className="space-y-5">
        <div>
          <Label>Idioma</Label>
          <LanguagePicker value={language} onChange={setLanguage} />
        </div>
        <Field label="Palavra ou expressão">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: to look forward to" autoCapitalize="none" />
        </Field>
        <Field label="Tradução">
          <Input value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="Ex.: aguardar com expectativa" />
        </Field>
        <Field label="Frase de exemplo">
          <Input value={example} onChange={(e) => setExample(e.target.value)} placeholder="Opcional" />
        </Field>
        <ErrorNote message={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => save(true)}>
            Salvar e continuar
          </Button>
          <Button onClick={() => save(false)}>Salvar</Button>
        </div>
      </div>
    </Sheet>
  )
}

/** Revisão em flashcards com caixas de Leitner. */
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
    <div className="fixed inset-0 z-50 flex flex-col bg-paper px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken text-muted" aria-label="Fechar">
            <X size={18} strokeWidth={1.75} />
          </button>
          <span className="num text-sm text-muted">
            {Math.min(index + 1, queue.length)} de {queue.length}
          </span>
        </div>
        <Progress value={index / queue.length} tone="accent" className="mt-4" />

        {card ? (
          <>
            <button onClick={() => setRevealed(true)} className="mt-6 flex flex-1 flex-col justify-center rounded-3xl bg-surface p-8 shadow-card text-left">
              <LangBadge language={card.language} className="self-start" />
              <p className="mt-6 font-serif text-[44px] leading-[1.05]">{card.term}</p>
              <div className={cx('mt-8 border-t border-line pt-6 transition-opacity duration-300', revealed ? 'opacity-100' : 'opacity-0')}>
                <p className="text-xl font-medium">{card.translation}</p>
                {card.example && <p className="mt-3 text-lg text-muted">“{card.example}”</p>}
              </div>
              {!revealed && <p className="mt-2 text-sm text-faint">Toque para revelar</p>}
            </button>
            {revealed ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="lg" onClick={() => answer(false)}>
                  Não lembrei
                </Button>
                <Button size="lg" onClick={() => answer(true)}>
                  Lembrei
                </Button>
              </div>
            ) : (
              <Button block size="lg" variant="secondary" onClick={() => setRevealed(true)} className="mt-4">
                Mostrar tradução
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-1 animate-rise flex-col justify-center">
            <p className="text-[13px] font-medium text-muted">Revisão concluída</p>
            <p className="mt-2 font-serif text-[52px] leading-none">
              {right}
              <span className="text-faint">/{queue.length}</span>
            </p>
            <p className="mt-3 text-muted">palavras lembradas. As que ficaram para trás voltam amanhã.</p>
            <Button size="lg" className="mt-10" onClick={onClose}>
              Concluir
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
