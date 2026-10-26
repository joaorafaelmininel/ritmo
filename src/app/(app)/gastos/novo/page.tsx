'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonPicker, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, Choice, ErrorNote, Field, Input, PageHeader, Select } from '@/components/ui'
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
      setReadMessage('Li a nota! Confira os dados antes de salvar.')
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
    toast('Gasto registrado 💸')
    router.push('/gastos')
  }

  return (
    <>
      <PageHeader title="Novo gasto" back="/gastos" />

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />

      {!preview ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-ameixa-500 to-ameixa-700 p-5 text-left text-white shadow-lg shadow-ameixa-600/20 active:scale-[0.99]"
        >
          <span className="text-4xl">📸</span>
          <span>
            <span className="block text-lg font-extrabold">Fotografar nota fiscal</span>
            <span className="block text-sm opacity-85">A IA lê valor, data, loja e itens para você</span>
          </span>
        </button>
      ) : (
        <Card className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Nota fiscal" className="h-20 w-16 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            {readState === 'reading' ? (
              <p className="flex items-center gap-2 font-semibold text-ameixa-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ameixa-100 border-t-ameixa-500" /> Lendo a nota…
              </p>
            ) : (
              <p className={readState === 'done' ? 'font-semibold text-salvia-500' : 'text-sm font-semibold text-rosa-500'}>{readMessage}</p>
            )}
            <button type="button" className="mt-1 text-sm font-semibold text-tinta/50 underline" onClick={() => fileRef.current?.click()}>
              Trocar foto
            </button>
          </div>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        <Field label="Valor">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-tinta/40">R$</span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))}
              placeholder="0,00"
              className="!pl-11 text-2xl font-extrabold"
            />
          </div>
        </Field>
        <Field label="Descrição">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Compras da semana" />
        </Field>
        <Field label="Estabelecimento (opcional)">
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Ex.: Pão de Açúcar" />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-tinta/80">Categoria</span>
          <Choice options={EXPENSE_CATEGORIES.map((c) => ({ ...c }))} value={category} onChange={setCategory} columns={4} />
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
          <span className="mb-1.5 block text-sm font-semibold text-tinta/80">Quem pagou?</span>
          <PersonPicker value={paidBy} onChange={setPaidBy} allowBoth />
        </div>

        {items.length > 0 && (
          <details className="rounded-2xl bg-white p-4 shadow-suave">
            <summary className="cursor-pointer font-semibold">🧾 {items.length} itens lidos da nota</summary>
            <ul className="mt-3 divide-y divide-black/5 text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">
                    {it.quantity && it.quantity !== 1 ? `${it.quantity}× ` : ''}
                    {it.name}
                  </span>
                  {it.total != null && <span className="shrink-0 tabular-nums text-tinta/60">{money(it.total)}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        <ErrorNote message={error} />
        <Button block onClick={save} disabled={saving || readState === 'reading'} className="!min-h-[56px] text-lg">
          {saving ? 'Salvando…' : 'Salvar gasto'}
        </Button>
      </div>
    </>
  )
}
