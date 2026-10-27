import {
  Apple,
  BookOpen,
  Briefcase,
  Car,
  Circle,
  Clapperboard,
  CloudRain,
  CloudSun,
  Coffee,
  GraduationCap,
  Headphones,
  HeartPulse,
  Home,
  Leaf,
  MessagesSquare,
  Moon,
  PawPrint,
  PenLine,
  Puzzle,
  Receipt,
  Sandwich,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Snowflake,
  Soup,
  Sparkles,
  SpellCheck,
  Stethoscope,
  Sun,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { MealType } from './types'

export type Option<T extends string | number = string> = { value: T; label: string; icon?: LucideIcon; hint?: string }

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const EFFORT_LEVELS: Option<number>[] = [
  { value: 1, label: 'Leve' },
  { value: 2, label: 'Moderado' },
  { value: 3, label: 'Puxado' },
  { value: 4, label: 'Intenso' },
  { value: 5, label: 'Exaustivo' },
]

export const MOODS: Option[] = [
  { value: 'otima', label: 'Ótima' },
  { value: 'bem', label: 'Bem' },
  { value: 'normal', label: 'Normal' },
  { value: 'cansada', label: 'Sem energia' },
  { value: 'dor', label: 'Com dor' },
]

/** Registros antigos guardavam emoji no humor; mantém a leitura deles. */
const LEGACY_MOODS: Record<string, string> = { '🤩': 'otima', '😊': 'bem', '😐': 'normal', '😔': 'cansada', '🤕': 'dor' }

export function moodLabel(value: string | null | undefined) {
  if (!value) return null
  const key = LEGACY_MOODS[value] ?? value
  return MOODS.find((m) => m.value === key)?.label ?? null
}

export const COMPLETION_OPTIONS = [
  { value: 'completo' as const, label: 'Completo', hint: 'Fiz tudo' },
  { value: 'parcial' as const, label: 'Parcial', hint: 'Fiz uma parte' },
  { value: 'nao' as const, label: 'Não fiz', hint: 'Não consegui' },
]

export const MEAL_TYPES: { value: MealType; label: string; icon: LucideIcon }[] = [
  { value: 'cafe', label: 'Café da manhã', icon: Coffee },
  { value: 'lanche_manha', label: 'Lanche da manhã', icon: Apple },
  { value: 'almoco', label: 'Almoço', icon: UtensilsCrossed },
  { value: 'lanche_tarde', label: 'Lanche da tarde', icon: Sandwich },
  { value: 'jantar', label: 'Jantar', icon: Soup },
  { value: 'ceia', label: 'Ceia', icon: Moon },
]

export const MEAL_FEELINGS = [
  { value: 'otimo' as const, label: 'Leve' },
  { value: 'ok' as const, label: 'Normal' },
  { value: 'pesado' as const, label: 'Pesado' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'mercado', label: 'Mercado', icon: ShoppingCart, color: '#6F8C74' },
  { value: 'restaurante', label: 'Restaurante', icon: UtensilsCrossed, color: '#B0623F' },
  { value: 'casa', label: 'Casa', icon: Home, color: '#8C857A' },
  { value: 'transporte', label: 'Transporte', icon: Car, color: '#5D6E86' },
  { value: 'saude', label: 'Saúde', icon: HeartPulse, color: '#4E8282' },
  { value: 'beleza', label: 'Beleza', icon: Sparkles, color: '#B76E79' },
  { value: 'lazer', label: 'Lazer', icon: Clapperboard, color: '#7D5D7B' },
  { value: 'educacao', label: 'Educação', icon: GraduationCap, color: '#B48C3F' },
  { value: 'pets', label: 'Pets', icon: PawPrint, color: '#9A7B5B' },
  { value: 'vestuario', label: 'Vestuário', icon: Shirt, color: '#6B5E8C' },
  { value: 'contas', label: 'Contas', icon: Receipt, color: '#556B5A' },
  { value: 'outros', label: 'Outros', icon: Circle, color: '#A39E95' },
] as const

export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value)

export function categoryInfo(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

export const PAYMENT_METHODS = ['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Boleto']

export const ACTIVITY_CATEGORIES = [
  { value: 'casa', label: 'Casa', icon: Home },
  { value: 'trabalho', label: 'Trabalho', icon: Briefcase },
  { value: 'saude', label: 'Saúde', icon: Stethoscope },
  { value: 'compras', label: 'Compras', icon: ShoppingBag },
  { value: 'social', label: 'Social', icon: Users },
  { value: 'pessoal', label: 'Pessoal', icon: Leaf },
]

export const PERFUME_FAMILIES = ['Floral', 'Frutado', 'Cítrico', 'Amadeirado', 'Oriental', 'Gourmand', 'Aquático', 'Chipre', 'Fougère', 'Verde']

const FAMILY_COLORS: Record<string, string> = {
  Floral: '#B76E79',
  Frutado: '#B0623F',
  Cítrico: '#B48C3F',
  Amadeirado: '#8A6A4F',
  Oriental: '#7D5D7B',
  Gourmand: '#9A6B45',
  Aquático: '#5D6E86',
  Chipre: '#556B5A',
  Fougère: '#6F8C74',
  Verde: '#4E8282',
}

export function familyColor(family: string | null) {
  return (family && FAMILY_COLORS[family]) || '#8C857A'
}

export const PERFUME_CONCENTRATIONS = ['Parfum', 'EDP', 'EDT', 'EDC', 'Body splash', 'Óleo']
export const OCCASIONS = ['Dia a dia', 'Trabalho', 'Encontro', 'Festa', 'Academia', 'Viagem', 'Em casa']
export const WEATHER = [
  { value: 'calor', label: 'Calor', icon: Sun },
  { value: 'ameno', label: 'Ameno', icon: CloudSun },
  { value: 'frio', label: 'Frio', icon: Snowflake },
  { value: 'chuva', label: 'Chuva', icon: CloudRain },
]

export const LANGUAGES = [
  { value: 'Inglês', code: 'EN' },
  { value: 'Espanhol', code: 'ES' },
  { value: 'Francês', code: 'FR' },
  { value: 'Italiano', code: 'IT' },
  { value: 'Alemão', code: 'DE' },
  { value: 'Japonês', code: 'JA' },
  { value: 'Coreano', code: 'KO' },
  { value: 'Mandarim', code: 'ZH' },
]

export function languageCode(language: string) {
  return LANGUAGES.find((l) => l.value === language)?.code ?? language.slice(0, 2).toUpperCase()
}

export const STUDY_KINDS = [
  { value: 'vocabulario', label: 'Vocabulário', icon: SpellCheck },
  { value: 'gramatica', label: 'Gramática', icon: Puzzle },
  { value: 'leitura', label: 'Leitura', icon: BookOpen },
  { value: 'escuta', label: 'Escuta', icon: Headphones },
  { value: 'conversa', label: 'Conversação', icon: MessagesSquare },
  { value: 'escrita', label: 'Escrita', icon: PenLine },
  { value: 'app', label: 'Aplicativo', icon: Smartphone },
  { value: 'aula', label: 'Aula', icon: GraduationCap },
]

export function studyKind(value: string) {
  return STUDY_KINDS.find((k) => k.value === value) ?? STUDY_KINDS[0]
}

/** Intervalo (em dias) até a próxima revisão para cada caixa de Leitner. */
export const LEITNER_INTERVALS = [0, 1, 2, 4, 8, 16]

/** Cores do monograma de cada pessoa (o valor fica em profiles.avatar). */
export const PERSON_COLORS = [
  { value: 'clay', color: '#9A4A2C' },
  { value: 'sage', color: '#4F6F58' },
  { value: 'slate', color: '#4D5E78' },
  { value: 'plum', color: '#6E4F6C' },
  { value: 'ochre', color: '#9C7633' },
  { value: 'ink', color: '#1D1C1A' },
]

export function personColor(avatar: string | null | undefined, fallbackIndex = 0) {
  return PERSON_COLORS.find((c) => c.value === avatar)?.color ?? PERSON_COLORS[fallbackIndex % PERSON_COLORS.length].color
}
