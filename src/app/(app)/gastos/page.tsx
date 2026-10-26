'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, EmptyState, Fab, PageHeader, SectionTitle, Sheet, Spinner } from '@/components/ui'
import { categoryInfo } from '@/lib/constants'
import { friendlyDay, isoDay, money } from '@/lib/format'
import type { Expense } from '@/lib/types'

function monthRange(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  return { start: isoDay(start), end: isoDay(end), label: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
}

export default function GastosPage() {
  const { members, nameOf, avatarOf } = useHousehold()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [expenses, setExpenses] = useState<Expense[] | null>(null)
  const [selected, setSelected] = useState<Expense | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const range = monthRange(offset)

  useEffect(() => {
    setExpenses(null)
    supabaseBrowser()
      .from('expenses')
      .select('*')
      .gte('spent_on', range.start)
      .lt('spent_on', range.end)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => setExpenses(data ?? []))
  }, [range.start, range.end])

  useEffect(() => {
    setReceiptUrl(null)
    if (!selected?.receipt_path) return
    supabaseBrowser()
      .storage.from('receipts')
      .createSignedUrl(selected.receipt_path, 600)
      .then(({ data }) => setReceiptUrl(data?.signedUrl ?? null))
  }, [selected])

  const stats = useMemo(() => {
    const list = expenses ?? []
    const total = list.reduce((s, e) => s + Number(e.amount), 0)
    const byCategory = new Map<string, number>()
    const byPerson = new Map<string, number>()
    for (const e of list) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount))
      const key = e.paid_by ?? 'both'
      byPerson.set(key, (byPerson.get(key) ?? 0) + Number(e.amount))
    }
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
    const days = new Map<string, Expense[]>()
    for (const e of list) days.set(e.spent_on, [...(days.get(e.spent_on) ?? []), e])
    return { total, categories, byPerson, days: [...days.entries()] }
  }, [expenses])

  async function remove(expense: Expense) {
    if (!confirm('Excluir este gasto?')) return
    const supabase = supabaseBrowser()
    await supabase.from('expenses').delete().eq('id', expense.id)
    if (expense.receipt_path) await supabase.storage.from('receipts').remove([expense.receipt_path])
    setExpenses((list) => list?.filter((e) => e.id !== expense.id) ?? null)
    setSelected(null)
    toast('Gasto excluído')
  }

  return (
    <>
      <PageHeader title="Gastos" subtitle="Para onde está indo o dinheiro" />

      <Card className="bg-gradient-to-br from-tinta to-ameixa-700 text-white">
        <div className="flex items-center justify-between">
          <button onClick={() => setOffset(offset - 1)} className="h-9 w-9 rounded-full text-xl hover:bg-white/10" aria-label="Mês anterior">
            ‹
          </button>
          <p className="text-sm font-semibold capitalize opacity-80">{range.label}</p>
          <button
            onClick={() => setOffset(offset + 1)}
            disabled={offset >= 0}
            className="h-9 w-9 rounded-full text-xl hover:bg-white/10 disabled:opacity-30"
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
        <p className="mt-2 text-center text-4xl font-extrabold tabular-nums">{money(stats.total)}</p>
        <p className="text-center text-sm opacity-70">{expenses?.length ?? 0} lançamentos</p>
        {members.length > 1 && stats.total > 0 && (
          <div className="mt-4 flex justify-center gap-4 text-sm">
            {[...members.map((m) => m.id), 'both'].map((id) =>
              stats.byPerson.get(id) ? (
                <span key={id} className="rounded-full bg-white/10 px-3 py-1">
                  {avatarOf(id === 'both' ? null : id)} {money(stats.byPerson.get(id))}
                </span>
              ) : null,
            )}
          </div>
        )}
      </Card>

      {!expenses ? (
        <Spinner />
      ) : expenses.length === 0 ? (
        <div className="mt-6">
          <EmptyState emoji="🧾" title="Nenhum gasto neste mês" text="Fotografe uma nota fiscal ou lance um gasto manualmente." />
        </div>
      ) : (
        <>
          <SectionTitle>Por categoria</SectionTitle>
          <Card className="space-y-3">
            {stats.categories.map(([cat, value]) => {
              const info = categoryInfo(cat)
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {info.emoji} {info.label}
                    </span>
                    <span className="tabular-nums text-tinta/70">
                      {money(value)} <span className="text-xs text-tinta/40">· {Math.round((value / stats.total) * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full bg-ameixa-500" style={{ width: `${(value / stats.categories[0][1]) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </Card>

          <SectionTitle>Lançamentos</SectionTitle>
          <div className="space-y-4">
            {stats.days.map(([day, list]) => (
              <div key={day}>
                <p className="mb-1.5 text-xs font-bold text-tinta/45">{friendlyDay(day)}</p>
                <Card className="divide-y divide-black/5 !py-1">
                  {list.map((e) => {
                    const info = categoryInfo(e.category)
                    return (
                      <button key={e.id} onClick={() => setSelected(e)} className="flex w-full items-center gap-3 py-3 text-left">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ameixa-50 text-xl">{info.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.description}</span>
                          <span className="block truncate text-xs text-tinta/50">
                            {[e.merchant, e.payment_method, `${avatarOf(e.paid_by)} ${nameOf(e.paid_by)}`].filter(Boolean).join(' · ')}
                            {e.source === 'nota' && ' · 🧾'}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">{money(e.amount)}</span>
                      </button>
                    )
                  })}
                </Card>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.description ?? ''}>
        {selected && (
          <div className="space-y-4">
            <p className="text-3xl font-extrabold">{money(selected.amount)}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Categoria" value={`${categoryInfo(selected.category).emoji} ${categoryInfo(selected.category).label}`} />
              <Info label="Data" value={friendlyDay(selected.spent_on)} />
              <Info label="Estabelecimento" value={selected.merchant ?? '—'} />
              <Info label="Pagamento" value={selected.payment_method ?? '—'} />
              <Info label="Quem pagou" value={`${avatarOf(selected.paid_by)} ${nameOf(selected.paid_by)}`} />
            </dl>
            {selected.items && selected.items.length > 0 && (
              <div className="rounded-2xl bg-white p-3 text-sm shadow-suave">
                <p className="mb-1 font-semibold">Itens</p>
                <ul className="divide-y divide-black/5">
                  {selected.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2 py-1">
                      <span className="truncate">{it.name}</span>
                      {it.total != null && <span className="shrink-0 tabular-nums text-tinta/60">{money(it.total)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptUrl} alt="Foto da nota" className="max-h-80 w-full rounded-2xl object-contain bg-white" />
              </a>
            )}
            <Button variant="danger" block onClick={() => remove(selected)}>
              Excluir gasto
            </Button>
          </div>
        )}
      </Sheet>

      <Fab href="/gastos/novo" label="Gasto" />
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-suave">
      <dt className="text-xs text-tinta/50">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  )
}
