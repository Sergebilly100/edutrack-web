import type { ReviewEvaluation } from './evaluation-review.api'

export type EvaluationState = 'complete' | 'correction' | 'expected' | 'late' | 'future' | 'undated' | 'empty'

export const completionPercent = (entered: number, expected: number): number =>
  expected > 0 ? Math.min(100, Math.round(entered * 100 / expected)) : 0

export const evaluationStatus = (
  evaluation: Pick<ReviewEvaluation, 'date' | 'expectedCount' | 'enteredCount' | 'notes'>,
  policy: { graceDays: number; lateDays: number },
  today: string,
): { state: EvaluationState; label: string; canRemind: boolean; daysSince: number | null } => {
  const expected = evaluation.expectedCount ?? evaluation.notes.length
  const entered = evaluation.enteredCount ?? evaluation.notes.filter((note) => note.score !== null).length
  if (expected === 0) return { state: 'empty', label: 'Aucun élève', canRemind: false, daysSince: null }
  if (entered >= expected) return { state: 'complete', label: 'Complet', canRemind: false, daysSince: null }
  if (!evaluation.date) return { state: 'undated', label: 'Date à préciser', canRemind: false, daysSince: null }
  const date = Date.parse(`${evaluation.date}T00:00:00Z`)
  const todayDate = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(date) || !Number.isFinite(todayDate)) return { state: 'undated', label: 'Date à préciser', canRemind: false, daysSince: null }
  const daysSince = Math.floor((todayDate - date) / 86_400_000)
  if (daysSince < 0) return { state: 'future', label: 'À venir', canRemind: false, daysSince }
  if (daysSince <= policy.graceDays) return { state: 'correction', label: 'En cours de correction', canRemind: false, daysSince }
  if (daysSince <= policy.lateDays) return { state: 'expected', label: 'Saisie attendue', canRemind: true, daysSince }
  return { state: 'late', label: `En retard de ${daysSince} jours`, canRemind: true, daysSince }
}

export const todayInAbidjan = (): string => {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}
