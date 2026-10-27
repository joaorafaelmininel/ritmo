'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { HouseholdProvider, useHousehold } from '@/components/HouseholdProvider'
import { Button, ErrorNote, Field, Input } from '@/components/ui'

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
  const [mode, setMode] = useState<'criar' | 'entrar'>('criar')
  const [houseName, setHouseName] = useState('Nossa casa')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (household) router.replace('/')
  }, [household, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { error } =
      mode === 'criar' ? await supabase.rpc('create_household', { p_name: houseName }) : await supabase.rpc('join_household', { p_code: code })
    setLoading(false)
    if (error) return setError(error.message)
    router.replace(mode === 'criar' ? '/perfil' : '/')
  }

  return (
    <main className="mx-auto min-h-dvh max-w-sm px-6 pb-10 pt-[calc(4rem+env(safe-area-inset-top))]">
      <p className="text-2xs font-medium uppercase tracking-label text-muted">Primeiros passos</p>
      <h1 className="mt-2 font-serif text-[44px] leading-[1.02]">Olá, {me.display_name}.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        O app é compartilhado por uma “casa”. Crie a de vocês e envie o código de convite para o seu par — ou entre com o código que você recebeu.
      </p>

      <div className="mt-10 flex rounded-xl bg-sunken p-1">
        {(['criar', 'entrar'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`h-9 flex-1 rounded-lg text-[13px] font-medium transition ${mode === m ? 'bg-surface text-ink shadow-lift' : 'text-muted'}`}
          >
            {m === 'criar' ? 'Criar uma casa' : 'Tenho um código'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        {mode === 'criar' ? (
          <Field label="Nome da casa">
            <Input value={houseName} onChange={(e) => setHouseName(e.target.value)} />
          </Field>
        ) : (
          <Field label="Código de convite" hint="Seis caracteres, disponível no perfil do seu par.">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="num text-center font-medium tracking-[0.4em]"
              autoCapitalize="characters"
            />
          </Field>
        )}
        <ErrorNote message={error} />
        <Button type="submit" block size="lg" disabled={loading || (mode === 'entrar' && code.length < 6)}>
          {mode === 'criar' ? 'Criar casa' : 'Entrar na casa'}
        </Button>
      </form>
    </main>
  )
}
