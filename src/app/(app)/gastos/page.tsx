'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Receipt, ScanLine } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonMark, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, EmptyState, Fab, IconTile, PageHeader, SectionTitle, Sheet, Spinner } from '@/components/ui'
import { categoryInfo } from '@/lib/constants'
import { capFirst, friendlyDay, isoDay, money } from '@/lib/format'
import type { Expense } from '@/lib/types'

function monthRange(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  return { start: isoDay(start), end: isoDay(end), label: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
}

export default function GastosPage() {
  const { members, nameOf } = useHousehold()
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

  const payers = [...members.map((m) => m.id as string), 'both'].filter((id) => stats.byPerson.get(id))

  return (
    <>
      <PageHeader eyebrow="Finanças" title="Gastos" />

      <div className="flex items-center justify-between">
        <button onClick={() => setOffset(offset - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Mês anterior">
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <p className="text-sm font-medium text-ink-soft">{capFirst(range.label)}</p>
        <button
          onClick={() => setOffset(offset + 1)}
          disabled={offset >= 0}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="figure text-[56px] leading-none tracking-[-0.01em]">{money(stats.total)}</p>
        <p className="mt-2 text-sm text-muted">
          {expenses?.length ?? 0} {expenses?.length === 1 ? 'lançamento' : 'lançamentos'}
        </p>
      </div>

      {members.length > 1 && payers.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {payers.map((id) => (
            <span key={id} className="flex items-center gap-2 whitespace-nowrap text-sm">
              <PersonMark id={id === 'both' ? null : id} size={22} />
              <span className="text-muted">{nameOf(id === 'both' ? null : id)}</span>
              <span className="num font-medium">{money(stats.byPerson.get(id))}</span>
            </span>
          ))}
        </div>
      )}

      {!expenses ? (
        <Spinner />
      ) : expenses.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={Receipt} title="Nenhum gasto no mês" text="Fotografe uma nota fiscal ou registre um gasto manualmente." />
        </div>
      ) : (
        <>
          <SectionTitle>Por categoria</SectionTitle>
          <Card>
            <div className="flex h-2 overflow-hidden rounded-full">
              {stats.categories.map(([cat, value]) => (
                <div key={cat} style={{ width: `${(value / stats.total) * 100}%`, backgroundColor: categoryInfo(cat).color }} className="h-full first:rounded-l-full last:rounded-r-full" />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5">
              {stats.categories.map(([cat, value]) => {
                const info = categoryInfo(cat)
                return (
                  <li key={cat} className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: info.color }} />
                    <span className="flex-1">{info.label}</span>
                    <span className="num w-10 text-right text-xs text-muted">{Math.round((value / stats.total) * 100)}%</span>
                    <span className="num w-24 text-right font-medium">{money(value)}</span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <SectionTitle>Lançamentos</SectionTitle>
          <div className="space-y-5">
            {stats.days.map(([day, list]) => (
              <div key={day}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <p className="text-xs font-medium text-ink-soft">{friendlyDay(day)}</p>
                  <p className="num text-xs text-muted">{money(list.reduce((s, e) => s + Number(e.amount), 0))}</p>
                </div>
                <Card className="divide-y divide-line !py-0">
                  {list.map((e) => {
                    const info = categoryInfo(e.category)
                    return (
                      <button key={e.id} onClick={() => setSelected(e)} className="flex w-full items-center gap-3.5 py-3 text-left">
                        <IconTile icon={info.icon} color={info.color} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{e.description}</span>
                            {e.source === 'nota' && <ScanLine size={13} className="shrink-0 text-faint" aria-label="Lido da nota" />}
                          </span>
                          <span className="block truncate text-xs text-muted">{[e.merchant, e.payment_method, nameOf(e.paid_by)].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="num shrink-0 font-medium">{money(e.amount)}</span>
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
          <div className="space-y-5">
            <p className="figure text-[44px] leading-none">{money(selected.amount)}</p>
            <dl className="divide-y divide-line rounded-2xl bg-surface shadow-card px-4 text-sm">
              <Info label="Categoria" value={categoryInfo(selected.category).label} />
              <Info label="Data" value={friendlyDay(selected.spent_on)} />
              <Info label="Estabelecimento" value={selected.merchant ?? '—'} />
              <Info label="Pagamento" value={selected.payment_method ?? '—'} />
              <Info label="Pago por" value={nameOf(selected.paid_by)} />
            </dl>
            {selected.items && selected.items.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted">Itens da nota</p>
                <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card px-4 text-sm">
                  {selected.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2.5">
                      <span className="truncate">{it.name}</span>
                      {it.total != null && <span className="num shrink-0 text-muted">{money(it.total)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptUrl} alt="Foto da nota" className="max-h-80 w-full rounded-2xl bg-surface shadow-card object-contain" />
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
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
