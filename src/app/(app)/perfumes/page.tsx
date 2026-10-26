'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Choice, EmptyState, ErrorNote, Field, Input, PageHeader, Pills, SectionTitle, Select, Sheet, Spinner, Stat, Textarea, cx } from '@/components/ui'
import { OCCASIONS, PERFUME_CONCENTRATIONS, PERFUME_FAMILIES, WEATHER, perfumeEmoji } from '@/lib/constants'
import { daysSince, friendlyDay, isoDay, sinceLabel } from '@/lib/format'
import type { Perfume, PerfumeWear } from '@/lib/types'

type Tab = 'colecao' | 'diario' | 'resumo'

export default function PerfumesPage() {
  const { me, members } = useHousehold()
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
    const map = new Map<string, { count: number; last: string; compliments: number }>()
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
      <PageHeader title="Perfumes" subtitle="Coleção e diário de fragrâncias" back="/mais" />

      {members.length > 1 && (
        <div className="mb-4">
          <Pills options={members.map((m) => ({ value: m.id, label: `${m.avatar} ${m.display_name}` }))} value={owner} onChange={setOwner} />
        </div>
      )}

      {/* Perfume de hoje */}
      <Card className="bg-gradient-to-br from-rosa-100 to-ameixa-50">
        <p className="text-sm font-semibold text-tinta/60">{isMe ? 'Seu perfume de hoje' : 'Perfume de hoje'}</p>
        {todayWears.length > 0 ? (
          <div className="mt-2 space-y-1">
            {todayWears.map((w) => (
              <p key={w.id} className="text-xl font-extrabold">
                {perfumeEmoji(byId.get(w.perfume_id)?.family ?? null)} {byId.get(w.perfume_id)?.name ?? 'Perfume'}
                <span className="ml-2 text-sm font-medium text-tinta/50">{[w.occasion, w.compliment && '😍 elogiado'].filter(Boolean).join(' · ')}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xl font-extrabold">{isMe ? 'Qual perfume você usou hoje?' : 'Nenhum registro hoje'}</p>
        )}
        {isMe && (
          <Button className="mt-3" onClick={() => setWearOpen(true)} disabled={collection.length === 0}>
            {todayWears.length ? '+ Registrar outro' : '🌸 Registrar perfume'}
          </Button>
        )}
        {isMe && collection.length === 0 && <p className="mt-2 text-xs text-tinta/50">Cadastre seus perfumes na coleção primeiro.</p>}
      </Card>

      <div className="mt-5">
        <Pills
          options={[
            { value: 'colecao', label: `Coleção (${collection.length})` },
            { value: 'diario', label: 'Diário' },
            { value: 'resumo', label: 'Resumo' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      {tab === 'colecao' && (
        <>
          {collection.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                emoji="🧴"
                title="A coleção está vazia"
                text="Adicione os perfumes que você tem para registrar qual usou em cada dia."
                action={isMe && <Button onClick={() => setEditing('novo')}>Adicionar perfume</Button>}
              />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {collection
                .slice()
                .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (usage.get(b.id)?.count ?? 0) - (usage.get(a.id)?.count ?? 0))
                .map((p) => {
                  const u = usage.get(p.id)
                  return (
                    <Card key={p.id} className="relative !p-3" onClick={isMe ? () => setEditing(p) : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isMe) toggleFavorite(p)
                        }}
                        className="absolute right-2 top-2 text-lg"
                        aria-label="Favorito"
                      >
                        {p.favorite ? '❤️' : '🤍'}
                      </button>
                      <span className="text-3xl">{perfumeEmoji(p.family)}</span>
                      <p className="mt-1 line-clamp-2 pr-4 font-bold leading-tight">{p.name}</p>
                      <p className="truncate text-xs text-tinta/55">{[p.brand, p.concentration].filter(Boolean).join(' · ') || '—'}</p>
                      {p.family && <span className="mt-2 inline-block rounded-full bg-ameixa-50 px-2 py-0.5 text-[11px] font-semibold text-ameixa-700">{p.family}</span>}
                      <p className="mt-2 text-[11px] text-tinta/50">
                        {u ? `Usado ${u.count}× · ${sinceLabel(u.last)}` : 'Ainda não usado'}
                      </p>
                    </Card>
                  )
                })}
            </div>
          )}

          {wishlist.length > 0 && (
            <>
              <SectionTitle>Quero ter ✨</SectionTitle>
              <div className="space-y-2">
                {wishlist.map((p) => (
                  <Card key={p.id} className="!p-3" onClick={isMe ? () => setEditing(p) : undefined}>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-tinta/55">{[p.brand, p.family].filter(Boolean).join(' · ')}</p>
                  </Card>
                ))}
              </div>
            </>
          )}

          {isMe && collection.length > 0 && (
            <Button variant="soft" block className="mt-4" onClick={() => setEditing('novo')}>
              + Adicionar perfume
            </Button>
          )}
        </>
      )}

      {tab === 'diario' && (
        <div className="mt-4 space-y-2">
          {myWears.length === 0 ? (
            <EmptyState emoji="📔" title="Diário vazio" text="Cada perfume registrado aparece aqui, dia a dia." />
          ) : (
            myWears.map((w) => {
              const weather = WEATHER.find((x) => x.value === w.weather)
              return (
                <Card key={w.id} className="!p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-tinta/45">{friendlyDay(w.worn_on)}</p>
                      <p className="font-bold">{byId.get(w.perfume_id)?.name ?? 'Perfume removido'}</p>
                      <p className="text-xs text-tinta/55">{[w.occasion, weather && `${weather.emoji} ${weather.label}`, w.compliment && '😍 Recebeu elogio'].filter(Boolean).join(' · ')}</p>
                      {w.note && <p className="mt-1 text-sm text-tinta/70">“{w.note}”</p>}
                    </div>
                    {w.rating && <span className="shrink-0 text-sm">{'⭐'.repeat(w.rating)}</span>}
                  </div>
                </Card>
              )
            })
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
            toast('Perfume registrado 🌸')
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

function Summary({
  perfumes,
  usage,
  wears,
}: {
  perfumes: Perfume[]
  usage: Map<string, { count: number; last: string; compliments: number }>
  wears: PerfumeWear[]
}) {
  const monthStart = isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const thisMonth = wears.filter((w) => w.worn_on >= monthStart)
  const compliments = wears.filter((w) => w.compliment).length
  const ranking = perfumes
    .map((p) => ({ p, u: usage.get(p.id) }))
    .filter((x) => x.u)
    .sort((a, b) => b.u!.count - a.u!.count)
    .slice(0, 5)
  const forgotten = perfumes
    .map((p) => ({ p, days: usage.get(p.id) ? daysSince(usage.get(p.id)!.last) : Infinity }))
    .filter((x) => x.days >= 30)
    .sort((a, b) => b.days - a.days)
  const champion = perfumes
    .map((p) => ({ p, c: usage.get(p.id)?.compliments ?? 0 }))
    .sort((a, b) => b.c - a.c)[0]

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="No mês" value={thisMonth.length} tone="rosa" />
        <Stat label="Elogios" value={compliments} tone="mel" />
        <Stat label="Na coleção" value={perfumes.length} tone="ameixa" />
      </div>

      {champion && champion.c > 0 && (
        <Card className="bg-mel-100">
          <p className="text-sm font-semibold text-tinta/60">😍 Campeão de elogios</p>
          <p className="text-lg font-extrabold">
            {champion.p.name} <span className="text-sm font-medium text-tinta/60">({champion.c} elogios)</span>
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-2 font-bold">🏆 Mais usados</p>
        {ranking.length === 0 ? (
          <p className="text-sm text-tinta/50">Registre alguns usos para ver o ranking.</p>
        ) : (
          <ol className="space-y-2">
            {ranking.map(({ p, u }, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-5 text-center font-extrabold text-ameixa-600">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                <span className="text-sm text-tinta/60">{u!.count}×</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {forgotten.length > 0 && (
        <Card>
          <p className="mb-1 font-bold">💤 Esquecidos na prateleira</p>
          <p className="mb-2 text-xs text-tinta/50">Sem uso há mais de 30 dias — que tal dar uma chance?</p>
          <ul className="space-y-1 text-sm">
            {forgotten.map(({ p, days }) => (
              <li key={p.id} className="flex justify-between">
                <span className="font-semibold">{p.name}</span>
                <span className="text-tinta/50">{days === Infinity ? 'nunca usado' : `${days} dias`}</span>
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
  usage: Map<string, { count: number; last: string }>
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
    <Sheet open={open} onClose={onClose} title="Qual perfume você usou?">
      <div className="space-y-5">
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto p-0.5">
          {sorted.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPerfumeId(p.id)}
              className={cx(
                'rounded-xl border-2 p-3 text-left transition',
                perfumeId === p.id ? 'border-ameixa-500 bg-ameixa-50' : 'border-transparent bg-white shadow-suave',
              )}
            >
              <p className="line-clamp-2 text-sm font-bold leading-tight">
                {p.favorite && '❤️ '}
                {p.name}
              </p>
              <p className="truncate text-[11px] text-tinta/50">{p.brand ?? ''}</p>
            </button>
          ))}
        </div>

        <Field label="Dia">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Ocasião</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOccasion(o)}
                className={cx('rounded-full px-3.5 py-2 text-sm font-semibold', occasion === o ? 'bg-tinta text-white' : 'bg-white shadow-suave')}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Clima</p>
          <Choice options={WEATHER} value={weather} onChange={setWeather} columns={4} size="sm" />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-tinta/80">Como ficou? (opcional)</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} className="text-3xl transition active:scale-90">
                {rating && n <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCompliment(!compliment)}
          className={cx('flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left font-semibold', compliment ? 'border-rosa-500 bg-rosa-100' : 'border-transparent bg-white shadow-suave')}
        >
          <span className="text-2xl">{compliment ? '😍' : '🙂'}</span>
          Recebi elogio pelo perfume
        </button>

        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anotação (fixação, quem elogiou…)" />
        <ErrorNote message={error} />
        <Button block onClick={save} disabled={saving}>
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
    if (!name.trim()) return setError('Qual o nome do perfume?')
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
    toast(isNew ? 'Perfume adicionado 🧴' : 'Perfume atualizado')
    onSaved()
  }

  async function remove() {
    if (!perfume || perfume === 'novo') return
    if (!confirm(`Remover "${perfume.name}" e todo o histórico de uso dele?`)) return
    await supabaseBrowser().from('perfumes').delete().eq('id', perfume.id)
    toast('Perfume removido')
    onSaved()
  }

  return (
    <Sheet open={!!perfume} onClose={onClose} title={isNew ? 'Novo perfume' : 'Editar perfume'}>
      <div className="space-y-4">
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
        <label className="flex items-center gap-3 rounded-xl bg-white p-3 font-semibold shadow-suave">
          <input type="checkbox" checked={wishlist} onChange={(e) => setWishlist(e.target.checked)} className="h-5 w-5 accent-ameixa-600" />
          Ainda não tenho — está na lista de desejos
        </label>
        <ErrorNote message={error} />
        <Button block onClick={save}>
          Salvar
        </Button>
        {!isNew && (
          <Button block variant="ghost" onClick={remove}>
            Remover perfume
          </Button>
        )}
      </div>
    </Sheet>
  )
}
