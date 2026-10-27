'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flower2, Heart, Plus, Star } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonSwitch, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Chips, Choice, EmptyState, ErrorNote, Field, Input, Label, Metric, PageHeader, SectionTitle, Segmented, Select, Sheet, Spinner, Textarea, cx } from '@/components/ui'
import { OCCASIONS, PERFUME_CONCENTRATIONS, PERFUME_FAMILIES, WEATHER, familyColor } from '@/lib/constants'
import { daysSince, friendlyDay, isoDay, sinceLabel } from '@/lib/format'
import type { Perfume, PerfumeWear } from '@/lib/types'

type Tab = 'colecao' | 'diario' | 'resumo'
type Usage = Map<string, { count: number; last: string; compliments: number }>

export default function PerfumesPage() {
  const { me } = useHousehold()
  const toast = useToast()
  const [owner, setOwner] = useState(me.id)
  const [tab, setTab] = useState<Tab>('colecao')
  const [perfumes, setPerfumes] = useState<Perfume[] | null>(null)
  const [wears, setWears] = useState<PerfumeWear[]>([])
  const [wearOpen, setWearOpen] = useState(false)
  const [editing, setEditing] = useState<Perfume | 'novo' | null>(null)

  const load = useCallback(async () => {
    const supabase = supabaseBrowser()
    const [p, w] = await Promise.all([
      supabase.from('perfumes').select('*').order('name'),
      supabase.from('perfume_wears').select('*').order('worn_on', { ascending: false }).order('created_at', { ascending: false }).limit(300),
    ])
    setPerfumes(p.data ?? [])
    setWears(w.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const mine = useMemo(() => (perfumes ?? []).filter((p) => p.owner_id === owner), [perfumes, owner])
  const myWears = useMemo(() => wears.filter((w) => w.user_id === owner), [wears, owner])
  const byId = useMemo(() => new Map((perfumes ?? []).map((p) => [p.id, p])), [perfumes])
  const todayWears = myWears.filter((w) => w.worn_on === isoDay())

  const usage = useMemo(() => {
    const map: Usage = new Map()
    for (const w of myWears) {
      const u = map.get(w.perfume_id) ?? { count: 0, last: w.worn_on, compliments: 0 }
      u.count++
      if (w.worn_on > u.last) u.last = w.worn_on
      if (w.compliment) u.compliments++
      map.set(w.perfume_id, u)
    }
    return map
  }, [myWears])

  if (!perfumes) return <Spinner />

  const isMe = owner === me.id
  const collection = mine.filter((p) => !p.wishlist)
  const wishlist = mine.filter((p) => p.wishlist)

  async function toggleFavorite(p: Perfume) {
    await supabaseBrowser().from('perfumes').update({ favorite: !p.favorite }).eq('id', p.id)
    setPerfumes((list) => list?.map((x) => (x.id === p.id ? { ...x, favorite: !p.favorite } : x)) ?? null)
  }

  return (
    <>
      <PageHeader eyebrow="Fragrâncias" title="Perfumes" back="/mais" />
      <PersonSwitch value={owner} onChange={setOwner} />

      {/* Perfume de hoje */}
      <div className="rounded-2xl bg-surface shadow-card p-5">
        <p className="text-[13px] font-medium text-muted">{isMe ? 'Seu perfume hoje' : 'Perfume de hoje'}</p>
        {todayWears.length > 0 ? (
          <div className="mt-2 space-y-1">
            {todayWears.map((w) => {
              const p = byId.get(w.perfume_id)
              return (
                <div key={w.id}>
                  <p className="font-serif text-[26px] leading-tight">{p?.name ?? 'Perfume'}</p>
                  <p className="text-sm text-muted">{[p?.brand, w.occasion, w.compliment && 'recebeu elogio'].filter(Boolean).join(' · ')}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-2 font-serif text-[26px] leading-tight text-ink-soft">{isMe ? 'Qual você escolheu hoje?' : 'Nenhum registro hoje'}</p>
        )}
        {isMe && (
          <Button className="mt-4" variant={todayWears.length ? 'secondary' : 'primary'} icon={Plus} onClick={() => setWearOpen(true)} disabled={collection.length === 0}>
            {todayWears.length ? 'Registrar outro' : 'Registrar perfume'}
          </Button>
        )}
        {isMe && collection.length === 0 && <p className="mt-2 text-xs text-muted">Adicione perfumes à coleção para começar.</p>}
      </div>

      <div className="mt-6">
        <Segmented
          options={[
            { value: 'colecao', label: `Coleção · ${collection.length}` },
            { value: 'diario', label: 'Diário' },
            { value: 'resumo', label: 'Resumo' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'colecao' && (
        <>
          {collection.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={Flower2}
                title="Coleção vazia"
                text="Cadastre os perfumes que você tem para registrar o uso de cada dia."
                action={isMe && <Button onClick={() => setEditing('novo')}>Adicionar perfume</Button>}
              />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {collection
                .slice()
                .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (usage.get(b.id)?.count ?? 0) - (usage.get(a.id)?.count ?? 0))
                .map((p) => {
                  const u = usage.get(p.id)
                  const color = familyColor(p.family)
                  return (
                    <Card key={p.id} className="relative flex flex-col !p-0" onClick={isMe ? () => setEditing(p) : undefined}>
                      <div className="relative flex h-24 items-end rounded-t-2xl px-4 pb-3" style={{ backgroundColor: `${color}14` }}>
                        <span className="font-serif text-[40px] leading-none" style={{ color }}>
                          {(p.brand ?? p.name).slice(0, 1)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isMe) toggleFavorite(p)
                          }}
                          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full"
                          aria-label={p.favorite ? 'Remover dos favoritos' : 'Favoritar'}
                        >
                          <Heart size={17} strokeWidth={1.75} className={p.favorite ? 'fill-accent text-accent' : 'text-faint'} />
                        </button>
                      </div>
                      <div className="flex flex-1 flex-col p-4 pt-3">
                        <p className="line-clamp-2 font-medium leading-snug">{p.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{[p.brand, p.concentration].filter(Boolean).join(' · ') || '—'}</p>
                        <div className="mt-auto pt-3">
                          {p.family && (
                            <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {p.family}
                            </p>
                          )}
                          <p className="num mt-1 text-xs text-faint">{u ? `${u.count}× · ${sinceLabel(u.last)}` : 'Ainda não usado'}</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
            </div>
          )}

          {wishlist.length > 0 && (
            <>
              <SectionTitle>Lista de desejos</SectionTitle>
              <Card className="divide-y divide-line !py-0">
                {wishlist.map((p) => (
                  <button key={p.id} className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={isMe ? () => setEditing(p) : undefined}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{[p.brand, p.family].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: familyColor(p.family) }} />
                  </button>
                ))}
              </Card>
            </>
          )}

          {isMe && collection.length > 0 && (
            <Button variant="secondary" block icon={Plus} className="mt-5" onClick={() => setEditing('novo')}>
              Adicionar perfume
            </Button>
          )}
        </>
      )}

      {tab === 'diario' && (
        <div className="mt-5">
          {myWears.length === 0 ? (
            <EmptyState icon={Flower2} title="Diário vazio" text="Cada perfume registrado aparece aqui, dia a dia." />
          ) : (
            <ol className="relative ml-1.5 border-l border-line">
              {myWears.map((w) => {
                const p = byId.get(w.perfume_id)
                const weather = WEATHER.find((x) => x.value === w.weather)
                return (
                  <li key={w.id} className="relative pb-6 pl-6 last:pb-0">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-paper" style={{ backgroundColor: familyColor(p?.family ?? null) }} />
                    <p className="text-xs font-medium text-muted">{friendlyDay(w.worn_on)}</p>
                    <p className="mt-0.5 font-serif text-[22px] leading-tight">{p?.name ?? 'Perfume removido'}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[w.occasion, weather?.label, w.compliment && 'Recebeu elogio'].filter(Boolean).join(' · ')}
                    </p>
                    {w.rating && (
                      <span className="mt-1.5 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={12} className={n <= w.rating! ? 'fill-ink text-ink' : 'text-line'} />
                        ))}
                      </span>
                    )}
                    {w.note && <p className="mt-1.5 text-sm text-ink-soft">“{w.note}”</p>}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'resumo' && <Summary perfumes={collection} usage={usage} wears={myWears} />}

      {isMe && (
        <WearSheet
          open={wearOpen}
          onClose={() => setWearOpen(false)}
          perfumes={collection}
          usage={usage}
          onSaved={() => {
            setWearOpen(false)
            toast('Perfume registrado')
            load()
          }}
        />
      )}

      <PerfumeSheet
        perfume={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </>
  )
}

function Summary({ perfumes, usage, wears }: { perfumes: Perfume[]; usage: Usage; wears: PerfumeWear[] }) {
  const monthStart = isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const thisMonth = wears.filter((w) => w.worn_on >= monthStart)
  const compliments = wears.filter((w) => w.compliment).length
  const ranking = perfumes
    .map((p) => ({ p, u: usage.get(p.id) }))
    .filter((x) => x.u)
    .sort((a, b) => b.u!.count - a.u!.count)
    .slice(0, 5)
  const maxCount = ranking[0]?.u?.count ?? 1
  const forgotten = perfumes
    .map((p) => ({ p, days: usage.get(p.id) ? daysSince(usage.get(p.id)!.last) : Infinity }))
    .filter((x) => x.days >= 30)
    .sort((a, b) => b.days - a.days)
  const champion = perfumes.map((p) => ({ p, c: usage.get(p.id)?.compliments ?? 0 })).sort((a, b) => b.c - a.c)[0]

  return (
    <div className="mt-5 space-y-3">
      <Card className="grid grid-cols-3 divide-x divide-line !px-0">
        <Metric className="px-4" label="No mês" value={thisMonth.length} detail="usos" />
        <Metric className="px-4" label="Elogios" value={compliments} detail="no total" />
        <Metric className="px-4" label="Coleção" value={perfumes.length} detail="perfumes" />
      </Card>

      {champion && champion.c > 0 && (
        <Card>
          <p className="text-[13px] font-medium text-muted">Mais elogiado</p>
          <p className="mt-1 font-serif text-[24px] leading-tight">{champion.p.name}</p>
          <p className="text-sm text-muted">
            {champion.c} {champion.c === 1 ? 'elogio' : 'elogios'}
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-4 text-[13px] font-medium text-muted">Mais usados</p>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">Registre alguns usos para ver o ranking.</p>
        ) : (
          <ol className="space-y-3">
            {ranking.map(({ p, u }, i) => (
              <li key={p.id}>
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="figure w-4 text-base text-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="num text-muted">{u!.count}×</span>
                </div>
                <div className="ml-7 mt-1.5 h-1 rounded-full bg-sunken">
                  <div className="h-full rounded-full" style={{ width: `${(u!.count / maxCount) * 100}%`, backgroundColor: familyColor(p.family) }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {forgotten.length > 0 && (
        <Card>
          <p className="text-[13px] font-medium text-muted">Esquecidos</p>
          <p className="mt-1 text-sm text-muted">Sem uso há mais de 30 dias.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {forgotten.map(({ p, days }) => (
              <li key={p.id} className="flex justify-between py-2.5">
                <span className="font-medium">{p.name}</span>
                <span className="num text-muted">{days === Infinity ? 'nunca usado' : `${days} dias`}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function WearSheet({
  open,
  onClose,
  perfumes,
  usage,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  perfumes: Perfume[]
  usage: Usage
  onSaved: () => void
}) {
  const [perfumeId, setPerfumeId] = useState<string | null>(null)
  const [day, setDay] = useState(isoDay())
  const [occasion, setOccasion] = useState('Dia a dia')
  const [weather, setWeather] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [compliment, setCompliment] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPerfumeId(null)
      setDay(isoDay())
      setRating(null)
      setCompliment(false)
      setNote('')
      setError(null)
    }
  }, [open])

  const sorted = perfumes
    .slice()
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (usage.get(b.id)?.last ?? '').localeCompare(usage.get(a.id)?.last ?? ''))

  async function save() {
    if (!perfumeId) return setError('Escolha o perfume.')
    setSaving(true)
    const { error } = await supabaseBrowser()
      .from('perfume_wears')
      .insert({ perfume_id: perfumeId, worn_on: day, occasion, weather, rating, compliment, note: note.trim() || null })
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Perfume do dia">
      <div className="space-y-6">
        <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-2xl bg-surface shadow-card">
          {sorted.map((p) => {
            const active = perfumeId === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPerfumeId(p.id)}
                className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition', active && 'bg-ink text-paper')}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: familyColor(p.family) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className={cx('block truncate text-xs', active ? 'text-white/70' : 'text-muted')}>{p.brand ?? ''}</span>
                </span>
                {p.favorite && <Heart size={14} className={active ? 'fill-paper text-paper' : 'fill-accent text-accent'} />}
              </button>
            )
          })}
        </div>

        <Field label="Dia">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>

        <div>
          <Label>Ocasião</Label>
          <Chips options={OCCASIONS.map((o) => ({ value: o, label: o }))} value={occasion} onChange={setOccasion} wrap />
        </div>

        <div>
          <Label>Clima</Label>
          <Choice options={WEATHER} value={weather} onChange={setWeather} columns={4} />
        </div>

        <div>
          <Label>Avaliação</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} className="p-1 transition active:scale-90" aria-label={`${n} estrelas`}>
                <Star size={26} strokeWidth={1.5} className={rating && n <= rating ? 'fill-ink text-ink' : 'text-line'} />
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3.5 shadow-card">
          <span className="font-medium">Recebi elogio</span>
          <input type="checkbox" checked={compliment} onChange={(e) => setCompliment(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10 rounded-full bg-line transition peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
        </label>

        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anotação: fixação, quem elogiou…" />
        <ErrorNote message={error} />
        <Button block size="lg" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Registrar'}
        </Button>
      </div>
    </Sheet>
  )
}

function PerfumeSheet({ perfume, onClose, onSaved }: { perfume: Perfume | 'novo' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [concentration, setConcentration] = useState('')
  const [family, setFamily] = useState('')
  const [notes, setNotes] = useState('')
  const [wishlist, setWishlist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const p = perfume && perfume !== 'novo' ? perfume : null
    setName(p?.name ?? '')
    setBrand(p?.brand ?? '')
    setConcentration(p?.concentration ?? '')
    setFamily(p?.family ?? '')
    setNotes(p?.notes ?? '')
    setWishlist(p?.wishlist ?? false)
    setError(null)
  }, [perfume])

  const isNew = perfume === 'novo'

  async function save() {
    if (!name.trim()) return setError('Informe o nome do perfume.')
    const data = {
      name: name.trim(),
      brand: brand.trim() || null,
      concentration: concentration || null,
      family: family || null,
      notes: notes.trim() || null,
      wishlist,
    }
    const supabase = supabaseBrowser()
    const { error } = isNew ? await supabase.from('perfumes').insert(data) : await supabase.from('perfumes').update(data).eq('id', (perfume as Perfume).id)
    if (error) return setError(error.message)
    toast(isNew ? 'Perfume adicionado' : 'Perfume atualizado')
    onSaved()
  }

  async function remove() {
    if (!perfume || perfume === 'novo') return
    if (!confirm(`Remover "${perfume.name}" e todo o histórico de uso?`)) return
    await supabaseBrowser().from('perfumes').delete().eq('id', perfume.id)
    toast('Perfume removido')
    onSaved()
  }

  return (
    <Sheet open={!!perfume} onClose={onClose} title={isNew ? 'Novo perfume' : 'Editar perfume'}>
      <div className="space-y-5">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: La Vie Est Belle" />
        </Field>
        <Field label="Marca">
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex.: Lancôme" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Concentração">
            <Select value={concentration} onChange={setConcentration}>
              <option value="">—</option>
              {PERFUME_CONCENTRATIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Família olfativa">
            <Select value={family} onChange={setFamily}>
              <option value="">—</option>
              {PERFUME_FAMILIES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notas olfativas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: íris, pralinê, baunilha" />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3.5 shadow-card">
          <span>
            <span className="block font-medium">Lista de desejos</span>
            <span className="block text-xs text-muted">Ainda não tenho este perfume</span>
          </span>
          <input type="checkbox" checked={wishlist} onChange={(e) => setWishlist(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10 shrink-0 rounded-full bg-line transition peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
        </label>
        <ErrorNote message={error} />
        <Button block size="lg" onClick={save}>
          Salvar
        </Button>
        {!isNew && (
          <Button block variant="danger" onClick={remove}>
            Remover perfume
          </Button>
        )}
      </div>
    </Sheet>
  )
}
