export type Profile = {
  id: string
  household_id: string | null
  display_name: string
  avatar: string
  weekly_study_goal_minutes: number
  daily_water_goal: number
}

export type Household = { id: string; name: string; invite_code: string }

export type WorkoutPlan = {
  id: string
  assigned_to: string | null
  created_by: string
  name: string
  description: string | null
  emoji: string
  weekdays: number[]
  archived: boolean
  plan_exercises?: PlanExercise[]
}

export type PlanExercise = {
  id: string
  plan_id: string
  position: number
  name: string
  sets: number | null
  reps: string | null
  load: string | null
  rest_seconds: number | null
  notes: string | null
}

export type Completion = 'completo' | 'parcial' | 'nao'

export type WorkoutSession = {
  id: string
  user_id: string
  plan_id: string | null
  plan_name: string
  started_at: string
  finished_at: string | null
  duration_minutes: number | null
  completion: Completion | null
  effort: number | null
  mood: string | null
  feeling_note: string | null
}

export type MealType = 'cafe' | 'lanche_manha' | 'almoco' | 'lanche_tarde' | 'jantar' | 'ceia'

export type Meal = {
  id: string
  user_id: string
  eaten_on: string
  meal_type: MealType
  description: string
  feeling: 'otimo' | 'ok' | 'pesado' | null
  on_plan: boolean
}

export type ExpenseItem = { name: string; quantity?: number | null; total?: number | null }

export type Expense = {
  id: string
  paid_by: string | null
  amount: number
  description: string
  merchant: string | null
  category: string
  payment_method: string | null
  spent_on: string
  receipt_path: string | null
  items: ExpenseItem[] | null
  source: 'manual' | 'nota'
}

export type Activity = {
  id: string
  assigned_to: string | null
  title: string
  notes: string | null
  category: string
  due_on: string | null
  due_time: string | null
  done: boolean
}

export type Perfume = {
  id: string
  owner_id: string
  name: string
  brand: string | null
  concentration: string | null
  notes: string | null
  family: string | null
  favorite: boolean
  wishlist: boolean
}

export type PerfumeWear = {
  id: string
  user_id: string
  perfume_id: string
  worn_on: string
  occasion: string | null
  weather: string | null
  rating: number | null
  compliment: boolean
  note: string | null
}

export type StudySession = {
  id: string
  user_id: string
  language: string
  kind: string
  minutes: number
  studied_on: string
  mood: string | null
  note: string | null
}

export type VocabCard = {
  id: string
  user_id: string
  language: string
  term: string
  translation: string
  example: string | null
  box: number
  next_review: string
}
