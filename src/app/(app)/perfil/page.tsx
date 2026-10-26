'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, ErrorNote, Field, Input, PageHeader, SectionTitle, cx } from '@/components/ui'

const AVATARS = ['🙂', '😎', '🥰', '🦋', '🌻', '🐱', '🐶', '🦊', '🌙', '⭐', '🍓', '🧘‍♀️', '🏋️‍♂️', '👩', '👨']

export default function PerfilPage() {
  const router = useRouter()
  const toast = useToast()
  const { me, household, members, refresh } = useHousehold()
  const [name, setName] = useState(me.display_name)
  const [avatar, setAvatar] = useState(me.avatar)
  const [studyGoal, setStudyGoal] = useState(String(me.weekly_study_goal_minutes))
  const [waterGoal, setWaterGoal] = useState(String(me.daily_water_goal))
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const { error } = await supabaseBrowser()
      .from('profiles')
      .update({
        display_name: name.trim() || me.display_name,
        avatar,
        weekly_study_goal_minutes: Number(studyGoal) || 150,
        daily_water_goal: Number(waterGoal) || 8,
      })
      .eq('id', me.id)
    if (error) return setError(error.message)
    await refresh()
    toast('Perfil salvo')
  }

  async function share() {
    const text = `Entre no nosso app Nós Dois com o código ${household?.invite_code}: ${window.location.origin}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Convite copiado!')
      }
    } catch {}
  }

  async function logout() {
    await supabaseBrowser().auth.signOut()
    router.replace('/entrar')
  }

  return (
    <>
      <PageHeader title="Perfil" back="/mais" />

      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-tinta/80">Avatar</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={cx('h-11 w-11 rounded-xl text-2xl', avatar === a ? 'bg-ameixa-100 ring-2 ring-ameixa-500' : 'bg-white shadow-suave')}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta de estudo (min/semana)">
            <Input inputMode="numeric" value={studyGoal} onChange={(e) => setStudyGoal(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Meta de água (copos/dia)">
            <Input inputMode="numeric" value={waterGoal} onChange={(e) => setWaterGoal(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <ErrorNote message={error} />
        <Button block onClick={save}>
          Salvar perfil
        </Button>
      </div>

      <SectionTitle>{household?.name ?? 'Casa'}</SectionTitle>
      <Card>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="rounded-full bg-ameixa-50 px-3 py-1.5 text-sm font-semibold">
              {m.avatar} {m.display_name}
            </span>
          ))}
        </div>
        {members.length < 2 && <p className="mt-3 text-sm text-tinta/60">Convide seu par: basta criar a conta no app e digitar este código.</p>}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-creme p-3">
          <span className="font-mono text-2xl font-extrabold tracking-[0.3em]">{household?.invite_code}</span>
          <Button variant="soft" onClick={share}>
            Compartilhar
          </Button>
        </div>
      </Card>

      <Button block variant="ghost" className="mt-6" onClick={logout}>
        Sair da conta
      </Button>
    </>
  )
}
