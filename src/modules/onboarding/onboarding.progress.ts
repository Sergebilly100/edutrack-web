export type OnboardingStep = 1 | 2 | 3 | 4 | 5
export const progressKey = (schoolId: string) => `onboarding_progress:v2:${schoolId}`
export function parseStep(value: unknown): OnboardingStep | null {
  const step = typeof value === "string" && /^[1-5]$/.test(value) ? Number(value) : value
  return typeof step === "number" && Number.isInteger(step) && step >= 1 && step <= 5 ? step as OnboardingStep : null
}
export function loadStep(schoolId: string): OnboardingStep {
  try {
    // Legacy values have no reliable school identity: never migrate their contents.
    localStorage.removeItem("onboarding_progress")
    const raw = localStorage.getItem(progressKey(schoolId))
    if (!raw) return 1
    const saved: unknown = JSON.parse(raw)
    return typeof saved === "object" && saved !== null && "step" in saved ? parseStep(saved.step) ?? 1 : 1
  } catch { return 1 }
}
export function saveStep(schoolId: string, step: OnboardingStep) {
  try { localStorage.setItem(progressKey(schoolId), JSON.stringify({ step })) } catch { /* Storage is optional. */ }
}
export function clearProgress(schoolId: string) {
  try { localStorage.removeItem(progressKey(schoolId)) } catch { /* Storage is optional. */ }
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
