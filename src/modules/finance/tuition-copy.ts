import type { TuitionPlan } from "./finance.api"

type FormStep = { dueDate: string; cumulativeAmountExpected: number | string }

/**
 * La copie reprend le plan ENREGISTRÉ du niveau source : le bouton n'est actif que lorsque
 * le formulaire est identique au plan enregistré (aucune modification en attente).
 */
export function planFormMatchesSaved(plan: TuitionPlan | undefined, form: { totalAmount: string; registrationAmount: string; steps: FormStep[] }): boolean {
  if (!plan) return false
  if (Number(form.totalAmount) !== plan.totalAmount) return false
  if (Number(form.registrationAmount || 0) !== plan.registrationAmount) return false
  const steps = form.steps.filter((step) => step.dueDate !== "" || Number(step.cumulativeAmountExpected) !== 0)
  if (steps.length !== plan.scheduleSteps.length) return false
  return steps.every((step, index) => {
    const saved = plan.scheduleSteps[index]!
    return step.dueDate === saved.dueDate && Number(step.cumulativeAmountExpected) === saved.cumulativeAmountExpected
  })
}
