'use client'

import Link from 'next/link'
import { ChevronLeft, Plus, X, type LucideIcon } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  back,
  action,
}: {
  title: string
  eyebrow?: string
  subtitle?: string
  back?: string
  action?: ReactNode
}) {
  return (
    <header className="pb-6 pt-3">
      {back && (
        <Link href={back} className="-ml-1.5 mb-3 inline-flex items-center gap-0.5 text-sm font-medium text-muted transition hover:text-ink">
          <ChevronLeft size={18} strokeWidth={1.75} />
          Voltar
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-2xs font-medium uppercase tracking-label text-muted">{eyebrow}</p>}
          <h1 className="font-serif text-[40px] leading-[1.02] tracking-[-0.01em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

export function Card({ children, className, onClick, style }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cx('rounded-2xl border border-line bg-surface p-4', onClick && 'cursor-pointer transition active:scale-[0.995] hover:border-faint', className)}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between">
      <h2 className="text-2xs font-medium uppercase tracking-label text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function TextLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const className = 'text-[13px] font-medium text-ink underline decoration-line decoration-1 underline-offset-4 transition hover:decoration-ink'
  if (href)
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  block?: boolean
  icon?: LucideIcon
}

export function Button({ variant = 'primary', size = 'md', block, icon: Icon, className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-11' : 'h-14 text-base',
        variant === 'primary' && 'bg-ink text-paper hover:bg-ink-soft',
        variant === 'accent' && 'bg-accent text-white hover:bg-accent-ink',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:border-faint',
        variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
        variant === 'danger' && 'text-bad hover:bg-bad-soft',
        block && 'w-full',
        className,
      )}
    >
      {Icon && <Icon size={18} strokeWidth={1.75} />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[13px] font-medium text-ink-soft">{children}</p>
}

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-ink focus:ring-4 focus:ring-ink/5'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputClass, 'resize-none', props.className)} />
}

export function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, 'appearance-none pr-9')}>
        {children}
      </select>
      <ChevronLeft size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 text-muted" />
    </div>
  )
}

/** Grade de opções de escolha única. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  columns = 3,
  compact = false,
}: {
  options: { value: T; label: string; icon?: LucideIcon; hint?: string }[]
  value: T | null | undefined
  onChange: (value: T) => void
  columns?: number
  compact?: boolean
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            type="button"
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cx(
              'flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center transition active:scale-[0.97]',
              compact ? 'min-h-[44px] py-2' : 'min-h-[68px] py-3',
              active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-soft hover:border-faint',
            )}
          >
            {Icon && <Icon size={compact ? 16 : 20} strokeWidth={1.6} />}
            <span className="text-[13px] font-medium leading-tight">{o.label}</span>
            {o.hint && <span className={cx('text-2xs leading-tight', active ? 'text-paper/70' : 'text-muted')}>{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Escala numérica (1–5) com rótulos nas pontas. */
export function Scale({
  value,
  onChange,
  options,
}: {
  value: number | null
  onChange: (v: number) => void
  options: { value: number; label: string }[]
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((o) => {
          const active = value !== null && o.value <= value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-label={o.label}
              className={cx(
                'num h-12 rounded-lg border text-base font-medium transition active:scale-95',
                active ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-muted',
              )}
            >
              {o.value}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{options[0].label}</span>
        <span className="font-medium text-ink">{selected?.label ?? ''}</span>
        <span>{options[options.length - 1].label}</span>
      </div>
    </div>
  )
}

/** Controle segmentado (troca de pessoa, abas). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-9 flex-1 items-center justify-center gap-2 truncate rounded-lg px-3 text-[13px] font-medium transition',
            o.value === value ? 'bg-surface text-ink shadow-lift' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Fichas de seleção em linha (rolagem horizontal). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  wrap = false,
}: {
  options: { value: T; label: ReactNode }[]
  value: T | null
  onChange: (value: T) => void
  wrap?: boolean
}) {
  return (
    <div className={cx('flex gap-2', wrap ? 'flex-wrap' : 'no-scrollbar -mx-5 overflow-x-auto px-5')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition',
            o.value === value ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-soft hover:border-faint',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade bg-ink/30" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-lg animate-sheet overflow-y-auto rounded-t-3xl bg-paper px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line sm:hidden" />
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-serif text-[28px] leading-tight">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-muted hover:text-ink">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-muted">
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <p className="mt-4 font-serif text-2xl">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Fab({ onClick, label, href }: { onClick?: () => void; label: string; href?: string }) {
  const className =
    'fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-12 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-[15px] font-medium text-paper shadow-lift transition active:scale-95 md:right-[calc(50%-14rem)]'
  const content = (
    <>
      <Plus size={18} strokeWidth={2} />
      {label}
    </>
  )
  if (href)
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  )
}

/** Número de destaque com rótulo. */
export function Metric({ label, value, detail, className }: { label: string; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-2xs font-medium uppercase tracking-label text-muted">{label}</p>
      <p className="figure mt-1 whitespace-nowrap text-[28px] leading-none">{value}</p>
      {detail && <p className="mt-1.5 text-xs text-muted">{detail}</p>}
    </div>
  )
}

export function Progress({ value, className, tone = 'ink' }: { value: number; className?: string; tone?: 'ink' | 'accent' | 'good' }) {
  return (
    <div className={cx('h-1 w-full overflow-hidden rounded-full bg-sunken', className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-500', tone === 'ink' ? 'bg-ink' : tone === 'accent' ? 'bg-accent' : 'bg-good')}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

export function IconTile({ icon: Icon, color, className }: { icon: LucideIcon; color?: string; className?: string }) {
  return (
    <span
      className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', !color && 'bg-sunken text-ink-soft', className)}
      style={color ? { backgroundColor: `${color}1A`, color } : undefined}
    >
      <Icon size={18} strokeWidth={1.6} />
    </span>
  )
}

export function Monogram({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || '·'}
    </span>
  )
}

export function Divider() {
  return <div className="h-px bg-line" />
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" />
    </div>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-sm text-bad">{message}</p>
}
