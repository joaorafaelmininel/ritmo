'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { personColor } from '@/lib/constants'
import type { Household, Profile } from '@/lib/types'
import { Monogram, Spinner, cx } from './ui'

type HouseholdState = {
  me: Profile
  household: Household | null
  members: Profile[]
  partner: Profile | null
  nameOf: (id: string | null | undefined) => string
  colorOf: (id: string | null | undefined) => string
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
    const byId = new Map(members.map((m, i) => [m.id, { profile: m, index: i }]))
    return {
      me,
      household,
      members,
      partner: members.find((m) => m.id !== me.id) ?? null,
      nameOf: (id) => (id ? byId.get(id)?.profile.display_name ?? '—' : 'Todos'),
      colorOf: (id) => {
        const entry = id ? byId.get(id) : undefined
        return entry ? personColor(entry.profile.avatar, entry.index) : '#6E6E7A'
      },
      refresh: load,
    }
  }, [me, household, members, load])

  if (!value || (requireHousehold && !value.household && pathname !== '/bem-vindo')) {
    return <Spinner />
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Monograma da pessoa (ou de todos da casa, quando id é null). */
export function PersonMark({ id, size = 24 }: { id: string | null | undefined; size?: number }) {
  const { nameOf, colorOf, members } = useHousehold()
  if (!id) {
    return (
      <span className="inline-flex" style={{ width: size * 1.6 }}>
        {members.slice(0, 2).map((m, i) => (
          <span key={m.id} className="rounded-full ring-2 ring-surface" style={{ marginLeft: i ? -size * 0.4 : 0 }}>
            <Monogram name={m.display_name} color={colorOf(m.id)} size={size} />
          </span>
        ))}
      </span>
    )
  }
  return <Monogram name={nameOf(id)} color={colorOf(id)} size={size} />
}

/** Seletor "para quem?" com os membros da casa. */
export function PersonPicker({ value, onChange, allowBoth = false }: { value: string | null; onChange: (id: string | null) => void; allowBoth?: boolean }) {
  const { members, me } = useHousehold()
  const options = [
    ...members.map((m) => ({ id: m.id as string | null, label: m.id === me.id ? `${m.display_name} (você)` : m.display_name })),
    ...(allowBoth && members.length > 1 ? [{ id: null, label: 'Todos' }] : []),
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
            className={cx(
              'flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 text-[13px] font-medium transition',
              active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-soft hover:border-faint',
            )}
          >
            <PersonMark id={o.id} size={28} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Alternância entre as pessoas da casa, para ver os dados de cada uma. */
export function PersonSwitch({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { members, me, colorOf } = useHousehold()
  if (members.length < 2) return null
  return (
    <div className="mb-6 flex rounded-xl bg-sunken p-1">
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cx(
            'flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition',
            m.id === value ? 'bg-surface text-ink shadow-lift' : 'text-muted hover:text-ink',
          )}
        >
          <Monogram name={m.display_name} color={colorOf(m.id)} size={20} />
          {m.id === me.id ? 'Você' : m.display_name}
        </button>
      ))}
    </div>
  )
}
