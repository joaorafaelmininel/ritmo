'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Household, Profile } from '@/lib/types'
import { Spinner } from './ui'

type HouseholdState = {
  me: Profile
  household: Household | null
  members: Profile[]
  partner: Profile | null
  nameOf: (id: string | null | undefined) => string
  avatarOf: (id: string | null | undefined) => string
  refresh: () => Promise<void>
}

const Ctx = createContext<HouseholdState | null>(null)

export function useHousehold() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useHousehold precisa estar dentro de <HouseholdProvider>')
  return value
}

export function HouseholdProvider({ children, requireHousehold = true }: { children: ReactNode; requireHousehold?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Profile | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<Profile[]>([])

  const load = useCallback(async () => {
    const supabase = supabaseBrowser()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      router.replace('/entrar')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single()
    if (!profile) return
    setMe(profile)
    if (!profile.household_id) {
      setHousehold(null)
      setMembers([profile])
      if (requireHousehold) router.replace('/bem-vindo')
      return
    }
    const [{ data: h }, { data: m }] = await Promise.all([
      supabase.from('households').select('*').eq('id', profile.household_id).single(),
      supabase.from('profiles').select('*').eq('household_id', profile.household_id).order('created_at'),
    ])
    setHousehold(h)
    setMembers(m ?? [profile])
  }, [router, requireHousehold])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo<HouseholdState | null>(() => {
    if (!me) return null
    const byId = new Map(members.map((m) => [m.id, m]))
    return {
      me,
      household,
      members,
      partner: members.find((m) => m.id !== me.id) ?? null,
      nameOf: (id) => (id ? byId.get(id)?.display_name ?? '—' : 'Os dois'),
      avatarOf: (id) => (id ? byId.get(id)?.avatar ?? '🙂' : '💞'),
      refresh: load,
    }
  }, [me, household, members, load])

  if (!value || (requireHousehold && !value.household && pathname !== '/bem-vindo')) {
    return <Spinner />
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Seletor "para quem?" com os membros da casa. */
export function PersonPicker({
  value,
  onChange,
  allowBoth = false,
}: {
  value: string | null
  onChange: (id: string | null) => void
  allowBoth?: boolean
}) {
  const { members, me } = useHousehold()
  const options = [
    ...members.map((m) => ({ id: m.id as string | null, label: m.id === me.id ? `${m.display_name} (eu)` : m.display_name, emoji: m.avatar })),
    ...(allowBoth ? [{ id: null, label: 'Os dois', emoji: '💞' }] : []),
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id ?? 'both'}
            type="button"
            onClick={() => onChange(o.id)}
            className={
              'flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition ' +
              (active ? 'border-ameixa-500 bg-ameixa-50 text-ameixa-700' : 'border-transparent bg-white shadow-suave')
            }
          >
            <span className="text-lg">{o.emoji}</span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
