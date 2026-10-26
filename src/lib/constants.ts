import type { MealType } from './types'

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const EFFORT_LEVELS = [
  { value: 1, emoji: '😌', label: 'Leve' },
  { value: 2, emoji: '🙂', label: 'Tranquilo' },
  { value: 3, emoji: '😅', label: 'Puxado' },
  { value: 4, emoji: '🥵', label: 'Muito cansativo' },
  { value: 5, emoji: '😵', label: 'Exaustivo' },
]

export const MOODS = [
  { value: '🤩', emoji: '🤩', label: 'Incrível' },
  { value: '😊', emoji: '😊', label: 'Bem' },
  { value: '😐', emoji: '😐', label: 'Normal' },
  { value: '😔', emoji: '😔', label: 'Pra baixo' },
  { value: '🤕', emoji: '🤕', label: 'Com dor' },
]

export const COMPLETION_OPTIONS = [
  { value: 'completo' as const, emoji: '✅', label: 'Fiz tudo' },
  { value: 'parcial' as const, emoji: '🌗', label: 'Fiz uma parte' },
  { value: 'nao' as const, emoji: '⏸️', label: 'Não consegui' },
]

export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'cafe', label: 'Café da manhã', emoji: '☕' },
  { value: 'lanche_manha', label: 'Lanche da manhã', emoji: '🍎' },
  { value: 'almoco', label: 'Almoço', emoji: '🍽️' },
  { value: 'lanche_tarde', label: 'Lanche da tarde', emoji: '🥪' },
  { value: 'jantar', label: 'Jantar', emoji: '🍲' },
  { value: 'ceia', label: 'Ceia', emoji: '🥛' },
]

export const MEAL_FEELINGS = [
  { value: 'otimo' as const, emoji: '😋', label: 'Ótimo' },
  { value: 'ok' as const, emoji: '🙂', label: 'Ok' },
  { value: 'pesado' as const, emoji: '😮‍💨', label: 'Pesado' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'mercado', label: 'Mercado', emoji: '🛒' },
  { value: 'restaurante', label: 'Restaurante', emoji: '🍕' },
  { value: 'casa', label: 'Casa', emoji: '🏠' },
  { value: 'transporte', label: 'Transporte', emoji: '🚗' },
  { value: 'saude', label: 'Saúde', emoji: '💊' },
  { value: 'beleza', label: 'Beleza', emoji: '💅' },
  { value: 'lazer', label: 'Lazer', emoji: '🎬' },
  { value: 'educacao', label: 'Educação', emoji: '📚' },
  { value: 'pets', label: 'Pets', emoji: '🐾' },
  { value: 'vestuario', label: 'Roupas', emoji: '👗' },
  { value: 'contas', label: 'Contas', emoji: '🧾' },
  { value: 'outros', label: 'Outros', emoji: '✨' },
] as const

export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value)

export function categoryInfo(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

export const PAYMENT_METHODS = ['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Boleto']

export const ACTIVITY_CATEGORIES = [
  { value: 'casa', label: 'Casa', emoji: '🏡' },
  { value: 'trabalho', label: 'Trabalho', emoji: '💼' },
  { value: 'saude', label: 'Saúde', emoji: '🩺' },
  { value: 'compras', label: 'Compras', emoji: '🛍️' },
  { value: 'social', label: 'Social', emoji: '🥂' },
  { value: 'pessoal', label: 'Pessoal', emoji: '🌱' },
]

export const PERFUME_FAMILIES = ['Floral', 'Frutado', 'Cítrico', 'Amadeirado', 'Oriental', 'Gourmand', 'Aquático', 'Chipre', 'Fougère', 'Verde']
const FAMILY_EMOJI: Record<string, string> = {
  Floral: '🌸', Frutado: '🍓', Cítrico: '🍋', Amadeirado: '🪵', Oriental: '🪔', Gourmand: '🍯', Aquático: '🌊', Chipre: '🍃', Fougère: '🌿', Verde: '🌱',
}

export function perfumeEmoji(family: string | null) {
  return (family && FAMILY_EMOJI[family]) || '🌷'
}

export const PERFUME_CONCENTRATIONS = ['Parfum', 'EDP', 'EDT', 'EDC', 'Body splash', 'Óleo']
export const OCCASIONS = ['Dia a dia', 'Trabalho', 'Encontro', 'Festa', 'Academia', 'Viagem', 'Em casa']
export const WEATHER = [
  { value: 'calor', label: 'Calor', emoji: '☀️' },
  { value: 'ameno', label: 'Ameno', emoji: '⛅' },
  { value: 'frio', label: 'Frio', emoji: '❄️' },
  { value: 'chuva', label: 'Chuva', emoji: '🌧️' },
]

export const LANGUAGES = [
  { value: 'Inglês', flag: '🇬🇧' },
  { value: 'Espanhol', flag: '🇪🇸' },
  { value: 'Francês', flag: '🇫🇷' },
  { value: 'Italiano', flag: '🇮🇹' },
  { value: 'Alemão', flag: '🇩🇪' },
  { value: 'Japonês', flag: '🇯🇵' },
  { value: 'Coreano', flag: '🇰🇷' },
  { value: 'Mandarim', flag: '🇨🇳' },
]

export function languageFlag(language: string) {
  return LANGUAGES.find((l) => l.value === language)?.flag ?? '🌍'
}

export const STUDY_KINDS = [
  { value: 'vocabulario', label: 'Vocabulário', emoji: '🔤' },
  { value: 'gramatica', label: 'Gramática', emoji: '📐' },
  { value: 'leitura', label: 'Leitura', emoji: '📖' },
  { value: 'escuta', label: 'Escuta / série', emoji: '🎧' },
  { value: 'conversa', label: 'Conversação', emoji: '🗣️' },
  { value: 'escrita', label: 'Escrita', emoji: '✍️' },
  { value: 'app', label: 'App (Duolingo etc.)', emoji: '📱' },
  { value: 'aula', label: 'Aula', emoji: '🎓' },
]

export function studyKind(value: string) {
  return STUDY_KINDS.find((k) => k.value === value) ?? STUDY_KINDS[0]
}

/** Intervalo (em dias) até a próxima revisão para cada caixa de Leitner. */
export const LEITNER_INTERVALS = [0, 1, 2, 4, 8, 16]
