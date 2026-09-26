import { beforeEach, describe, expect, it, vi } from "vitest"
import { configurationLink, loadStep, onboardingReturn, parseStep, progressKey, saveStep } from "../onboarding.progress"

beforeEach(() => localStorage.clear())
describe("progression école", () => {
  it("invalide le brouillon commun sans le réutiliser", () => {
    localStorage.setItem("onboarding_progress", JSON.stringify({ step: 5, schoolInfo: { name: "École A" } }))
    expect(loadStep("B")).toBe(1)
    expect(localStorage.getItem("onboarding_progress")).toBeNull()
  })
  it("isole les écoles et ne persiste aucune validation locale", () => {
    saveStep("A", 3)
    expect(loadStep("B")).toBe(1)
    saveStep("B", 2)
    expect(loadStep("A")).toBe(3)
    expect(loadStep("B")).toBe(2)
    expect(JSON.parse(localStorage.getItem(progressKey("A"))!)).toEqual({ step: 3 })
  })
  it.each([null, 0, 6, 1.5, "2.0", "invalid", {}])("rejette l’étape %j", (step) => expect(parseStep(step)).toBeNull())
  it("tolère le JSON invalide et le stockage indisponible", () => {
    localStorage.setItem(progressKey("A"), "broken")
    expect(loadStep("A")).toBe(1)
    const mock = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    expect(() => saveStep("A", 2)).not.toThrow()
    mock.mockRestore()
  })
  it.each([
    ["/academic/levels", 2], ["/academic/subjects", 2], ["/rooms", 3],
    ["/settings?tab=finance", 3], ["/import?type=teachers", 4],
  ] as const)("retour guidé depuis %s", (path, step) => {
    const target = new URL(configurationLink(path, "A", step), "https://test.local")
    expect(onboardingReturn(target.search, "A")).toBe(`/onboarding?step=${step}&school=A`)
    expect(onboardingReturn(target.search, "B")).toBeNull()
    if (path.includes("?")) expect(target.searchParams.has(path.includes("finance") ? "tab" : "type")).toBe(true)
  })
  it.each(["https://evil.test", "//evil.test", "/dashboard?step=2&school=A", "/onboarding?step=9&school=A"])("refuse le retour %s", (target) => {
    expect(onboardingReturn(`?returnTo=${encodeURIComponent(target)}`, "A")).toBeNull()
  })
})
