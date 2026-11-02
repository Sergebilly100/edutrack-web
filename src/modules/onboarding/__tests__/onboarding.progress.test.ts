import { describe, expect, it } from "vitest"
import {
  canNavigateToStep,
  configurationLink,
  continueMessage,
  firstIncompleteStep,
  isStepComplete,
  onboardingFocusStep,
  isStepAccessible,
  onboardingReturn,
  parseStep,
  remainingStepLabel,
} from "../onboarding.progress"
import type { OnboardingStatus } from "../onboarding.api"

const status = (overrides: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
  schoolId: "A",
  schoolInfoComplete: false,
  activeYear: false,
  levels: false,
  subjects: false,
  rooms: false,
  fees: false,
  teachers: false,
  missing: [],
  canComplete: false,
  ...overrides,
})

describe("progression école", () => {
  it("utilise une seule définition de complétude pour chaque étape", () => {
    const complete = status({ schoolInfoComplete: true, activeYear: true, levels: true, subjects: true, rooms: true, fees: true, canComplete: true })
    expect([1, 2, 3, 4, 5].map((step) => isStepComplete(step as 1 | 2 | 3 | 4 | 5, complete))).toEqual([true, true, true, true, true])
    expect(isStepComplete(1, status({ activeYear: true }))).toBe(false)
    expect(isStepComplete(2, status({ levels: true }))).toBe(false)
    expect(isStepComplete(3, status({ rooms: true }))).toBe(false)
    expect(isStepComplete(4, status())).toBe(false)
    expect(isStepComplete(5, status({ schoolInfoComplete: true, activeYear: true, levels: true, subjects: true, rooms: true, fees: true }))).toBe(false)
  })
  it.each([null, 0, 6, 1.5, "2.0", "invalid", {}])("rejette l’étape %j", (step) => expect(parseStep(step)).toBeNull())
  it("verrouille les étapes selon les validations serveur", () => {
    const empty = status()
    expect(firstIncompleteStep(empty)).toBe(1)
    expect(isStepAccessible(1, empty)).toBe(true)
    expect(isStepAccessible(2, empty)).toBe(false)
    expect(firstIncompleteStep(status({ activeYear: true, schoolInfoComplete: false }))).toBe(1)
    expect(isStepAccessible(2, status({ activeYear: true, schoolInfoComplete: false }))).toBe(false)
    expect(isStepAccessible(3, status({ activeYear: true, schoolInfoComplete: false, levels: true, subjects: true }))).toBe(false)
    expect(firstIncompleteStep(status({ schoolInfoComplete: true, activeYear: true }))).toBe(2)
    expect(isStepAccessible(3, status({ schoolInfoComplete: true, activeYear: true, levels: true, subjects: true }))).toBe(true)
    expect(isStepAccessible(5, status({ schoolInfoComplete: true, activeYear: true, levels: true, subjects: true, rooms: true, fees: true }))).toBe(true)
    expect(firstIncompleteStep(status({ schoolInfoComplete: true, activeYear: true, levels: true, subjects: true, rooms: true, fees: true }))).toBe(5)
    expect(canNavigateToStep(1, 4, empty)).toBe(true)
    expect(canNavigateToStep(3, 4, empty)).toBe(true)
    expect(canNavigateToStep(5, 2, empty)).toBe(false)
  })
  it("calcule le libellé de progression et explique précisément les blocages", () => {
    expect(remainingStepLabel(1)).toBe("5 étapes restantes")
    expect(remainingStepLabel(4)).toBe("2 étapes restantes")
    expect(remainingStepLabel(5)).toBe("Dernière étape")
    expect(continueMessage(2, status({ schoolInfoComplete: true, activeYear: true, levels: true }))).toBe("Ajoutez au moins une matière pour continuer.")
    expect(continueMessage(2, status({ activeYear: true, schoolInfoComplete: false, levels: true, subjects: true }))).toBeNull()
    expect(continueMessage(3, status({ schoolInfoComplete: true, activeYear: true, levels: true, subjects: true, fees: false }))).toBe("Ajoutez au moins une salle active et configurez les frais de l’année active pour continuer.")
    expect(continueMessage(1, status({ activeYear: true, schoolInfoComplete: false }))).toContain("Le serveur ne confirme pas encore")
    expect(continueMessage(1, status({ activeYear: false }))).toContain("l’administration doit ouvrir l’année scolaire")
    expect(continueMessage(5, status({ activeYear: true, schoolInfoComplete: false }))).toContain("Vérifiez ces informations dans cette étape")
    expect(continueMessage(3, status({ rooms: true, fees: true }))).toBeNull()
  })
  it.each([
    ["/academic/levels", 2], ["/academic/subjects", 2],
    ["/academic/school-years", 2], ["/academic/classes", 2], ["/rooms", 3],
    ["/onboarding/fees", 3], ["/settings?tab=finance", 3], ["/import?type=teachers", 4],
  ] as const)("retour guidé depuis %s", (path, step) => {
    const target = new URL(configurationLink(path, "A", step), "https://test.local")
    expect(onboardingReturn(target.search, "A")).toBe(`/onboarding?step=${step}&school=A`)
    expect(onboardingReturn(target.search, "B")).toBeNull()
    expect(onboardingFocusStep(target.pathname, target.search, "A")).toBe(step)
    expect(onboardingFocusStep(target.pathname, target.search, "B")).toBeNull()
    if (path.includes("?")) expect(target.searchParams.has(path.includes("finance") ? "tab" : "type")).toBe(true)
  })
  it.each(["https://evil.test", "//evil.test", "/dashboard?step=2&school=A", "/onboarding?step=9&school=A"])("refuse le retour %s", (target) => {
    expect(onboardingReturn(`?returnTo=${encodeURIComponent(target)}`, "A")).toBeNull()
  })
})
