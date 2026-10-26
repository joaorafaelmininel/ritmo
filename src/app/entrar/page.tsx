'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button, ErrorNote, Field, Input } from '@/components/ui'

export default function EntrarPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'cadastro'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    const supabase = supabaseBrowser()
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('E-mail ou senha incorretos.')
      else router.replace('/')
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else if (data.session) router.replace('/bem-vindo')
      else setInfo('Enviamos um link de confirmação para o seu e-mail. Depois é só entrar.')
    }
    setLoading(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-ameixa-600 text-4xl shadow-lg shadow-ameixa-600/30">💞</div>
        <h1 className="text-3xl font-extrabold">Nós Dois</h1>
        <p className="mt-1 text-tinta/60">Treinos, dieta, gastos, perfumes e estudos — tudo num lugar só.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'cadastro' && (
          <Field label="Como quer ser chamada(o)?">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana" required />
          </Field>
        )}
        <Field label="E-mail">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Senha">
          <Input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorNote message={error} />
        {info && <p className="rounded-xl bg-salvia-100 px-3 py-2 text-sm font-medium text-salvia-500">{info}</p>}
        <Button type="submit" block disabled={loading}>
          {loading ? 'Um instante…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'cadastro' : 'login')}
        className="mt-6 text-center text-sm font-semibold text-ameixa-600"
      >
        {mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tenho conta'}
      </button>
    </main>
  )
}
