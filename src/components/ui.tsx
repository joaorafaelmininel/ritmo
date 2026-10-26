'use client'

import Link from 'next/link'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  back?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-3 pb-4 pt-2">
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <Link
            href={back}
            aria-label="Voltar"
            className="-ml-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-tinta/70 active:bg-black/5"
          >
            ‹
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-tinta/60">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx('rounded-2xl bg-white p-4 shadow-suave', onClick && 'cursor-pointer active:scale-[0.99] transition', className)}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wider text-tinta/50">{children}</h2>
      {action}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger'
  block?: boolean
}

export function Button({ variant = 'primary', block, className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 font-semibold transition active:scale-[0.98] disabled:opacity-50',
        variant === 'primary' && 'bg-ameixa-600 text-white shadow-suave hover:bg-ameixa-700',
        variant === 'soft' && 'bg-ameixa-50 text-ameixa-700 hover:bg-ameixa-100',
        variant === 'ghost' && 'text-tinta/70 hover:bg-black/5',
        variant === 'danger' && 'bg-rosa-100 text-rosa-500',
        block && 'w-full',
        className,
      )}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-tinta/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-tinta/50">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-base outline-none transition placeholder:text-tinta/35 focus:border-ameixa-500 focus:ring-4 focus:ring-ameixa-100'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputClass, 'resize-none', props.className)} />
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, 'appearance-none')}>
      {children}
    </select>
  )
}

/** Botões grandes de escolha única (com emoji), pensados para o toque. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  columns = 3,
  size = 'md',
}: {
  options: { value: T; label: string; emoji?: string }[]
  value: T | null | undefined
  onChange: (value: T) => void
  columns?: number
  size?: 'sm' | 'md'
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            type="button"
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cx(
              'flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 text-center transition active:scale-95',
              size === 'md' ? 'min-h-[76px] py-2.5' : 'min-h-[44px] py-1.5',
              active ? 'border-ameixa-500 bg-ameixa-50 text-ameixa-700' : 'border-transparent bg-white text-tinta/80 shadow-suave',
            )}
          >
            {o.emoji && <span className={size === 'md' ? 'text-2xl' : 'text-lg'}>{o.emoji}</span>}
            <span className="text-xs font-semibold leading-tight">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition',
            o.value === value ? 'bg-tinta text-white' : 'bg-white text-tinta/70 shadow-suave',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
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
      <div className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-creme px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 animate-sheet sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-tinta/50 hover:bg-black/5">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ emoji, title, text, action }: { emoji: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-black/10 px-6 py-10 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="mt-3 font-bold">{title}</p>
      {text && <p className="mt-1 text-sm text-tinta/60">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Fab({ onClick, label, href }: { onClick?: () => void; label: string; href?: string }) {
  const className =
    'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-ameixa-600 px-5 font-bold text-white shadow-lg shadow-ameixa-600/30 active:scale-95 transition md:right-[calc(50%-14rem)]'
  if (href) {
    return (
      <Link href={href} className={className}>
        <span className="text-2xl leading-none">+</span>
        {label}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className={className}>
      <span className="text-2xl leading-none">+</span>
      {label}
    </button>
  )
}

export function Stat({ label, value, tone = 'ameixa' }: { label: string; value: ReactNode; tone?: 'ameixa' | 'salvia' | 'pessego' | 'ceu' | 'mel' | 'rosa' }) {
  const tones = {
    ameixa: 'bg-ameixa-50 text-ameixa-700',
    salvia: 'bg-salvia-100 text-salvia-500',
    pessego: 'bg-pessego-100 text-pessego-500',
    ceu: 'bg-ceu-100 text-ceu-500',
    mel: 'bg-mel-100 text-mel-500',
    rosa: 'bg-rosa-100 text-rosa-500',
  }
  return (
    <div className={cx('rounded-2xl p-3', tones[tone])}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold">{value}</p>
    </div>
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-2.5 w-full overflow-hidden rounded-full bg-black/5', className)}>
      <div className="h-full rounded-full bg-ameixa-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-ameixa-100 border-t-ameixa-500" />
    </div>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-xl bg-rosa-100 px-3 py-2 text-sm font-medium text-rosa-500">{message}</p>
}
