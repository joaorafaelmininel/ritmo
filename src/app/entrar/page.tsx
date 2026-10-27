'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button, ErrorNote, Field, Input } from '@/components/ui'
import { Wordmark } from '@/components/Wordmark'

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
      else setInfo('Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.')
    }
    setLoading(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pb-10 pt-[calc(4rem+env(safe-area-inset-top))]">
      <div className="flex-1">
        <Wordmark className="text-[56px] leading-none" />
        <p className="mt-4 max-w-[17rem] text-[15px] leading-relaxed text-muted">
          Treinos, alimentação, finanças, perfumes e estudos. A rotina de vocês dois, organizada num só lugar.
        </p>

        <form onSubmit={submit} className="mt-12 space-y-5">
          {mode === 'cadastro' && (
            <Field label="Seu nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
            </Field>
          )}
          <Field label="E-mail">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Senha" hint={mode === 'cadastro' ? 'Mínimo de 6 caracteres.' : undefined}>
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
          {info && <p className="rounded-xl bg-good-soft px-3.5 py-2.5 text-sm text-good">{info}</p>}
          <Button type="submit" block size="lg" disabled={loading}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'}{' '}
        <button type="button" onClick={() => setMode(mode === 'login' ? 'cadastro' : 'login')} className="font-medium text-ink underline decoration-line underline-offset-4">
          {mode === 'login' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
    </main>
  )
}
