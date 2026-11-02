import type { OnboardingStatus } from "./onboarding.api"

export type OnboardingStep = 1 | 2 | 3 | 4 | 5
export const onboardingStepLabels = ["Infos école", "Référentiel scolaire", "Salles et frais", "Professeurs", "Terminer"] as const

export function parseStep(value: unknown): OnboardingStep | null {
  const step = typeof value === "string" && /^[1-5]$/.test(value) ? Number(value) : value
  return typeof step === "number" && Number.isInteger(step) && step >= 1 && step <= 5 ? step as OnboardingStep : null
}

export function isStepComplete(step: OnboardingStep, status: OnboardingStatus): boolean {
  switch (step) {
    case 1:
      return status.schoolInfoComplete && status.activeYear
    case 2:
      return status.levels && status.subjects
    case 3:
      return status.rooms && status.fees
    case 4:
      return isStepComplete(1, status) && isStepComplete(2, status) && isStepComplete(3, status)
    case 5:
      return status.canComplete
  }
}

const requiredSteps: readonly OnboardingStep[] = [1, 2, 3]

export function firstIncompleteStep(status: OnboardingStatus): OnboardingStep {
  return requiredSteps.find((step) => !isStepComplete(step, status)) ?? 5
}

export function isStepAccessible(step: OnboardingStep, status: OnboardingStatus): boolean {
  return requiredSteps
    .filter((requiredStep) => requiredStep < step)
    .every((requiredStep) => isStepComplete(requiredStep, status))
}

export function canNavigateToStep(
  targetStep: OnboardingStep,
  currentStep: OnboardingStep,
  status: OnboardingStatus,
): boolean {
  return targetStep <= currentStep || isStepAccessible(targetStep, status)
}

export function remainingStepLabel(step: OnboardingStep): string {
  if (step === 5) return "Dernière étape"
  const count = 6 - step
  return `${count} étape${count > 1 ? "s" : ""} restante${count > 1 ? "s" : ""}`
}

export function continueMessage(step: OnboardingStep, status: OnboardingStatus): string | null {
  const missing: string[] = []
  if (step === 1 && !isStepComplete(1, status)) {
    if (!status.schoolInfoComplete) missing.push("Le serveur ne confirme pas encore le nom, l’adresse et le téléphone du directeur. Vérifiez ces informations dans cette étape")
    if (!status.activeYear) missing.push("L’administration doit ouvrir l’année scolaire")
  }
  if (step === 2 && !isStepComplete(2, status)) {
    if (!status.levels) missing.push("Ajoutez au moins un niveau")
    if (!status.subjects) missing.push("Ajoutez au moins une matière")
  }
  if (step === 3 && !isStepComplete(3, status)) {
    if (!status.rooms) missing.push("Ajoutez au moins une salle active")
    if (!status.fees) missing.push("Configurez les frais de l’année active")
  }
  if (step === 5 && !isStepComplete(5, status)) {
    const firstIncomplete = firstIncompleteStep(status)
    if (firstIncomplete !== 5) {
      return continueMessage(firstIncomplete, status)
    }
    missing.push("Le serveur ne confirme pas que la configuration peut être finalisée. Réessayez après avoir vérifié les prérequis")
  }
  if (!missing.length) return null
  const message = missing.map((item, index) =>
    index === 0 ? item : `${item[0]?.toLocaleLowerCase("fr") ?? ""}${item.slice(1)}`,
  ).join(" et ")
  return `${message} pour continuer.`
}

export function clearProgress(schoolId: string) {
  try {
    localStorage.removeItem("onboarding_progress")
    localStorage.removeItem(`onboarding_progress:v2:${schoolId}`)
  } catch { /* Storage is optional. */ }
}
export function configurationLink(path: string, schoolId: string, step: OnboardingStep): string {
  const [pathname, search] = path.split("?")
  const params = new URLSearchParams(search)
  params.set("returnTo", `/onboarding?step=${step}&school=${encodeURIComponent(schoolId)}`)
  return `${pathname}?${params.toString()}`
}

export function onboardingReturn(search: string, schoolId: string | undefined): string | null {
  const target = new URLSearchParams(search).get("returnTo")
  if (!target || !schoolId) return null
  const [pathname, query] = target.split("?")
  const params = new URLSearchParams(query)
  const step = parseStep(params.get("step"))
  return pathname === "/onboarding" && params.get("school") === schoolId && step
    ? `/onboarding?step=${step}&school=${encodeURIComponent(schoolId)}` : null
}

export function onboardingFocusStep(pathname: string, search: string, schoolId: string | undefined): OnboardingStep | null {
  const returnTo = onboardingReturn(search, schoolId)
  if (!returnTo) return null

  const parameters = new URLSearchParams(search)
  const expectedOrigin = pathname === "/academic/levels" ||
    pathname === "/academic/subjects" ||
    pathname === "/academic/school-years" ||
    pathname === "/academic/classes"
    ? 2
    : pathname === "/rooms" || pathname === "/onboarding/fees" || (pathname === "/settings" && parameters.get("tab") === "finance")
      ? 3
      : pathname === "/import" && (parameters.get("type") === "teachers" || parameters.get("type") === "students")
        ? 4
        : null
  if (expectedOrigin === null) return null

  const originStep = parseStep(new URLSearchParams(returnTo.split("?")[1]).get("step"))
  return originStep === expectedOrigin ? originStep : null
}
