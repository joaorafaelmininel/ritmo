const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function money(value: number | string | null | undefined) {
  return brl.format(Number(value ?? 0))
}

/** Data local no formato YYYY-MM-DD (sem cair no dia anterior por causa do UTC). */
export function isoDay(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(day: string, n: number) {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}

export function parseDay(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfMonth(date = new Date()) {
  return isoDay(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return isoDay(d)
}

export function friendlyDay(day: string) {
  const today = isoDay()
  if (day === today) return 'Hoje'
  if (day === addDays(today, -1)) return 'Ontem'
  if (day === addDays(today, 1)) return 'Amanhã'
  return capFirst(parseDay(day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }))
}

export function daysSince(day: string) {
  return Math.round((parseDay(isoDay()).getTime() - parseDay(day).getTime()) / 86_400_000)
}

export function sinceLabel(day: string) {
  const n = daysSince(day)
  if (n <= 0) return 'hoje'
  if (n === 1) return 'ontem'
  return `há ${n} dias`
}

export function weekdayShort(day: string) {
  return parseDay(day).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function longToday() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Aceita "1.234,56", "1234,56", "12.50" ou "12". */
export function parseMoney(text: string) {
  const t = text.trim()
  if (!t) return 0
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d+\.\d{1,2}$/.test(t) ? t : t.replace(/\./g, '')
  const n = Number(normalized)
  return isFinite(n) ? n : 0
}

export function capFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
