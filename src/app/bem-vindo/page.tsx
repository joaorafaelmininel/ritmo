'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { HouseholdProvider, useHousehold } from '@/components/HouseholdProvider'
import { Button, Card, ErrorNote, Field, Input } from '@/components/ui'

export default function BemVindoPage() {
  return (
    <HouseholdProvider requireHousehold={false}>
      <Onboarding />
    </HouseholdProvider>
  )
}

function Onboarding() {
  const router = useRouter()
  const { me, household } = useHousehold()
  const [houseName, setHouseName] = useState('Nossa casa')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (household) router.replace('/')
  }, [household, router])

  async function create() {
    setLoading(true)
    setError(null)
    const { error } = await supabaseBrowser().rpc('create_household', { p_name: houseName })
    if (error) setError(error.message)
    else router.replace('/perfil?novo=1')
    setLoading(false)
  }

  async function join() {
    setLoading(true)
    setError(null)
    const { error } = await supabaseBrowser().rpc('join_household', { p_code: code })
    if (error) setError(error.message)
    else router.replace('/')
    setLoading(false)
  }

  return (
    <main className="mx-auto min-h-dvh max-w-sm px-6 py-12">
      <p className="text-4xl">👋</p>
      <h1 className="mt-3 text-2xl font-extrabold">Oi, {me.display_name}!</h1>
      <p className="mt-1 text-tinta/60">
        Para começar, crie a casa de vocês. Depois é só passar o código de convite para o seu par entrar também.
      </p>

      <Card className="mt-6 space-y-3">
        <h2 className="font-bold">🏡 Criar uma casa</h2>
        <Field label="Nome">
          <Input value={houseName} onChange={(e) => setHouseName(e.target.value)} />
        </Field>
        <Button block onClick={create} disabled={loading}>
          Criar
        </Button>
      </Card>

      <Card className="mt-4 space-y-3">
        <h2 className="font-bold">🔑 Já recebi um código</h2>
        <Field label="Código de convite">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex.: A1B2C3" maxLength={6} />
        </Field>
        <Button block variant="soft" onClick={join} disabled={loading || code.length < 6}>
          Entrar na casa
        </Button>
      </Card>

      <div className="mt-4">
        <ErrorNote message={error} />
      </div>
    </main>
  )
}
