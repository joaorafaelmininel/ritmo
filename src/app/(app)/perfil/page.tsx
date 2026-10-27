'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Share2 } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useHousehold } from '@/components/HouseholdProvider'
import { useToast } from '@/components/Toast'
import { Button, Card, ErrorNote, Field, Input, Label, Monogram, PageHeader, SectionTitle } from '@/components/ui'
import { PERSON_COLORS, personColor } from '@/lib/constants'

export default function PerfilPage() {
  const router = useRouter()
  const toast = useToast()
  const { me, household, members, refresh, colorOf } = useHousehold()
  const [name, setName] = useState(me.display_name)
  const [color, setColor] = useState(PERSON_COLORS.some((c) => c.value === me.avatar) ? me.avatar : PERSON_COLORS[0].value)
  const [studyGoal, setStudyGoal] = useState(String(me.weekly_study_goal_minutes))
  const [waterGoal, setWaterGoal] = useState(String(me.daily_water_goal))
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const { error } = await supabaseBrowser()
      .from('profiles')
      .update({
        display_name: name.trim() || me.display_name,
        avatar: color,
        weekly_study_goal_minutes: Number(studyGoal) || 150,
        daily_water_goal: Number(waterGoal) || 8,
      })
      .eq('id', me.id)
    if (error) return setError(error.message)
    await refresh()
    toast('Perfil salvo')
  }

  async function share() {
    const text = `Entre no Ritmo com o código ${household?.invite_code}: ${window.location.origin}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Convite copiado')
      }
    } catch {}
  }

  async function logout() {
    await supabaseBrowser().auth.signOut()
    router.replace('/entrar')
  }

  return (
    <>
      <PageHeader eyebrow="Conta" title="Perfil" back="/mais" />

      <div className="flex items-center gap-4">
        <Monogram name={name || me.display_name} color={personColor(color)} size={64} />
        <div>
          <p className="font-serif text-[24px] leading-tight">{name || me.display_name}</p>
          <p className="text-sm text-muted">{household?.name}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <Label>Cor</Label>
          <div className="flex gap-3">
            {PERSON_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-label={c.value}
                className="flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-paper transition"
                style={{ backgroundColor: c.color, boxShadow: color === c.value ? `0 0 0 2px #F3F3F5, 0 0 0 4px ${c.color}` : undefined }}
              >
                {color === c.value && <Check size={16} className="text-white" strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta de estudo" hint="minutos por semana">
            <Input inputMode="numeric" value={studyGoal} onChange={(e) => setStudyGoal(e.target.value.replace(/\D/g, ''))} className="num" />
          </Field>
          <Field label="Meta de água" hint="copos por dia">
            <Input inputMode="numeric" value={waterGoal} onChange={(e) => setWaterGoal(e.target.value.replace(/\D/g, ''))} className="num" />
          </Field>
        </div>
        <ErrorNote message={error} />
        <Button block size="lg" onClick={save}>
          Salvar alterações
        </Button>
      </div>

      <SectionTitle>Casa</SectionTitle>
      <Card>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <Monogram name={m.display_name} color={colorOf(m.id)} size={32} />
              <span className="font-medium">{m.display_name}</span>
              {m.id === me.id && <span className="text-xs text-muted">você</span>}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-[13px] font-medium text-muted">Código de convite</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="figure text-[36px] leading-none tracking-[0.15em]">{household?.invite_code}</span>
            <Button variant="secondary" icon={Share2} onClick={share}>
              Enviar
            </Button>
          </div>
          {members.length < 2 && <p className="mt-3 text-sm text-muted">Quem for participar cria uma conta no app e informa este código.</p>}
        </div>
      </Card>

      <Button block variant="ghost" className="mt-8" onClick={logout}>
        Sair da conta
      </Button>
    </>
  )
}
