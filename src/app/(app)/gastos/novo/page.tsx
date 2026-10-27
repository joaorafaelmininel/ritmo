'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { PersonPicker, useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Camera, X } from 'lucide-react'
import { Button, Choice, ErrorNote, Field, Input, Label, PageHeader, Select } from '@/components/ui'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants'
import { isoDay, parseMoney } from '@/lib/format'
import { resizeImage } from '@/lib/image'

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

  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const blob = await resizeImage(file)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
    } catch {
      setError('Não foi possível abrir a foto. Tente outra imagem.')
    }
  }

  function removePhoto() {
    setPhoto(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
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

      <div className="space-y-6">
        <div>
          <Label>Valor</Label>
          <div className="flex items-baseline gap-2 border-b border-line pb-2 focus-within:border-ink">
            <span className="font-serif text-2xl text-faint">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))}
              placeholder="0,00"
              autoFocus
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

        <div>
          <Label>Foto da nota (opcional)</Label>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {preview ? (
            <div className="flex items-center gap-4 rounded-2xl bg-surface p-3 shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Nota fiscal" className="h-20 w-16 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-sm font-medium">Foto anexada</p>
                <button type="button" className="mt-1 text-[13px] font-medium text-accent" onClick={() => fileRef.current?.click()}>
                  Trocar foto
                </button>
              </div>
              <button type="button" onClick={removePhoto} aria-label="Remover foto" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <Button variant="secondary" block icon={Camera} onClick={() => fileRef.current?.click()}>
              Fotografar ou escolher imagem
            </Button>
          )}
        </div>

        <ErrorNote message={error} />
        <Button block size="lg" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar gasto'}
        </Button>
      </div>
    </>
  )
}
