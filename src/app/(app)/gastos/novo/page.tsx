'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonPicker, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Camera, Check, ChevronRight } from 'lucide-react'
import { Button, Card, Choice, ErrorNote, Field, Input, Label, PageHeader, Select, cx } from '@/components/ui'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants'
import { isoDay, money, parseMoney } from '@/lib/format'
import { blobToBase64, resizeImage } from '@/lib/image'
import type { ExpenseItem } from '@/lib/types'

type ReadState = 'idle' | 'reading' | 'done' | 'failed'

export default function NovoGastoPage() {
  const router = useRouter()
  const toast = useToast()
  const { me, household } = useHousehold()
  const fileRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState<string>('mercado')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [spentOn, setSpentOn] = useState(isoDay())
  const [paidBy, setPaidBy] = useState<string | null>(me.id)
  const [items, setItems] = useState<ExpenseItem[]>([])

  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [readState, setReadState] = useState<ReadState>('idle')
  const [readMessage, setReadMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    setReadMessage(null)
    try {
      const blob = await resizeImage(file)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
      setReadState('reading')
      const res = await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: await blobToBase64(blob), mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReadState('failed')
        setReadMessage(data.error ?? 'Não consegui ler a nota. Preencha os campos abaixo.')
        return
      }
      if (data.total != null) setAmount(String(data.total.toFixed(2)).replace('.', ','))
      if (data.description) setDescription(data.description)
      if (data.merchant) setMerchant(data.merchant)
      if (data.category) setCategory(data.category)
      if (data.payment_method) setPaymentMethod(data.payment_method)
      if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) setSpentOn(data.date)
      setItems(data.items ?? [])
      setReadState('done')
      setReadMessage('Nota lida. Confira os dados antes de salvar.')
    } catch {
      setReadState('failed')
      setReadMessage('Não consegui ler a nota. Preencha os campos abaixo.')
    }
  }

  async function save() {
    const value = parseMoney(amount)
    if (!value || value <= 0) return setError('Informe o valor do gasto.')
    if (!description.trim() && !merchant.trim()) return setError('Descreva o gasto (ou informe o estabelecimento).')
    setSaving(true)
    setError(null)
    const supabase = supabaseBrowser()

    let receiptPath: string | null = null
    if (photo && household) {
      receiptPath = `${household.id}/${crypto.randomUUID()}.jpg`
      const { error: upError } = await supabase.storage.from('receipts').upload(receiptPath, photo, { contentType: 'image/jpeg' })
      if (upError) {
        setSaving(false)
        return setError(`Falha ao enviar a foto: ${upError.message}`)
      }
    }

    const { error } = await supabase.from('expenses').insert({
      amount: value,
      description: description.trim() || merchant.trim(),
      merchant: merchant.trim() || null,
      category,
      payment_method: paymentMethod || null,
      spent_on: spentOn,
      paid_by: paidBy,
      receipt_path: receiptPath,
      items: items.length ? items : null,
      source: photo ? 'nota' : 'manual',
    })
    setSaving(false)
    if (error) return setError(error.message)
    toast('Gasto registrado')
    router.push('/gastos')
  }

  return (
    <>
      <PageHeader eyebrow="Gastos" title="Novo gasto" back="/gastos" />

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />

      {!preview ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group flex w-full items-center gap-4 rounded-2xl bg-ink p-5 text-left text-paper transition active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper/10">
            <Camera size={22} strokeWidth={1.6} />
          </span>
          <span className="flex-1">
            <span className="block font-serif text-[24px] leading-tight">Fotografar nota fiscal</span>
            <span className="mt-0.5 block text-sm text-paper/60">Valor, data, loja e itens preenchidos automaticamente</span>
          </span>
          <ChevronRight size={18} className="text-paper/40 transition group-hover:translate-x-0.5" />
        </button>
      ) : (
        <Card className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Nota fiscal" className="h-20 w-16 rounded-lg border border-line object-cover" />
          <div className="min-w-0 flex-1">
            {readState === 'reading' ? (
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" /> Lendo a nota…
              </p>
            ) : (
              <p className={cx('flex items-start gap-1.5 text-sm font-medium', readState === 'done' ? 'text-good' : 'text-bad')}>
                {readState === 'done' && <Check size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />}
                {readMessage}
              </p>
            )}
            <button type="button" className="mt-1.5 text-[13px] font-medium text-muted underline decoration-line underline-offset-4" onClick={() => fileRef.current?.click()}>
              Trocar foto
            </button>
          </div>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        <div>
          <Label>Valor</Label>
          <div className="flex items-baseline gap-2 border-b border-line pb-2 focus-within:border-ink">
            <span className="font-serif text-2xl text-faint">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))}
              placeholder="0,00"
              className="figure w-full bg-transparent text-[44px] leading-none outline-none placeholder:text-line"
            />
          </div>
        </div>
        <Field label="Descrição">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Compras da semana" />
        </Field>
        <Field label="Estabelecimento">
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Opcional" />
        </Field>
        <div>
          <Label>Categoria</Label>
          <Choice options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value as string, label: c.label, icon: c.icon }))} value={category} onChange={setCategory} columns={4} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
          </Field>
          <Field label="Pagamento">
            <Select value={paymentMethod} onChange={setPaymentMethod}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <Label>Pago por</Label>
          <PersonPicker value={paidBy} onChange={setPaidBy} allowBoth />
        </div>

        {items.length > 0 && (
          <details className="group rounded-2xl border border-line bg-surface px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
              {items.length} itens lidos da nota
              <ChevronRight size={16} className="text-muted transition group-open:rotate-90" />
            </summary>
            <ul className="mt-2 divide-y divide-line text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {it.quantity && it.quantity !== 1 ? <span className="num text-muted">{it.quantity}× </span> : null}
                    {it.name}
                  </span>
                  {it.total != null && <span className="num shrink-0 text-muted">{money(it.total)}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        <ErrorNote message={error} />
        <Button block size="lg" onClick={save} disabled={saving || readState === 'reading'}>
          {saving ? 'Salvando…' : 'Salvar gasto'}
        </Button>
      </div>
    </>
  )
}
