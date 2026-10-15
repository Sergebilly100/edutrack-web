import { describe, expect, it } from 'vitest'
import { completionPercent, evaluationStatus } from '../evaluation-review.logic'
import type { ReviewEvaluation } from '../evaluation-review.api'

const evaluation = (date: string | null, enteredCount = 0, expectedCount = 24) => ({
  date, enteredCount, expectedCount, notes: [],
}) as Pick<ReviewEvaluation, 'date' | 'enteredCount' | 'expectedCount' | 'notes'>

describe('statut de saisie des évaluations', () => {
  const policy = { graceDays: 7, lateDays: 14 }
  const today = '2026-10-15'
  it.each([
    ['2026-10-15', 'correction', false],
    ['2026-10-08', 'correction', false],
    ['2026-10-07', 'expected', true],
    ['2026-10-01', 'expected', true],
    ['2026-09-30', 'late', true],
  ] as const)('classe correctement la borne %s', (date, state, canRemind) => {
    expect(evaluationStatus(evaluation(date), policy, today)).toMatchObject({ state, canRemind })
  })
  it('affiche le nombre de jours depuis la date en rouge', () => {
    expect(evaluationStatus(evaluation('2026-09-30'), policy, today).label).toBe('En retard de 15 jours')
  })
  it('respecte les paramètres modifiés, les notes complètes et les dates futures', () => {
    expect(evaluationStatus(evaluation('2026-10-10'), { graceDays: 3, lateDays: 4 }, today).state).toBe('late')
    expect(evaluationStatus(evaluation('2026-09-30', 24), policy, today).state).toBe('complete')
    expect(evaluationStatus(evaluation('2026-10-16'), policy, today).canRemind).toBe(false)
    expect(evaluationStatus(evaluation(null), policy, today).canRemind).toBe(false)
  })
  it('calcule la barre de complétion', () => {
    expect(completionPercent(6, 24)).toBe(25)
    expect(completionPercent(0, 0)).toBe(0)
  })
})
