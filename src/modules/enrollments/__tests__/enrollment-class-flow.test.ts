import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClassesResponse, Level, SchoolYear } from "@/modules/academic/academic.api"
import { useAuthStore, type AuthUser } from "@/shared/store/auth.store"
import { discardEnrollmentClassDraft, isEnrollmentReturnUrl, readEnrollmentClassDraft, resolveEnrollmentClassReturn, saveEnrollmentClassDraft } from "@/shared/lib/enrollment-class-flow"

const yearId = "550e8400-e29b-41d4-a716-446655440001"
const levelId = "550e8400-e29b-41d4-a716-446655440002"
const classId = "550e8400-e29b-41d4-a716-446655440003"
const user = { id: "user", tenantId: "school", schemaName: "school_test" } as AuthUser
const form = { firstName: "Aya", lastName: "Koné", birthDate: "", matricule: "", parentName: "Parent", parentPhone: "2250700000000", parentEmail: "", parentName2: "", parentPhone2: "" }
const save = () => saveEnrollmentClassDraft({ returnTo: "/enrollments/new", schoolYearId: yearId, levelId, classId: "", form })

beforeEach(() => { useAuthStore.getState().setUser(null); useAuthStore.getState().setUser(user) })

describe("brouillon du détour classe", () => {
  it("ne place aucune identité dans le contexte et isole chaque dossier", () => {
    const first = save(); const second = save()
    expect(first.draftId).not.toBe(second.draftId)
    expect(JSON.stringify(first)).not.toContain("Aya")
    expect(JSON.stringify(first)).not.toContain(form.parentPhone)
    expect(readEnrollmentClassDraft(first, "/enrollments/new")?.form).toEqual(form)
    expect(readEnrollmentClassDraft(first, `/enrollments/${classId}/edit`)).toBeNull()
    expect(readEnrollmentClassDraft({ ...first, levelId: classId })).toBeNull()
    discardEnrollmentClassDraft(first.draftId)
    expect(readEnrollmentClassDraft(first)).toBeNull()
    expect(readEnrollmentClassDraft(second)).not.toBeNull()
  })

  it("efface les données au changement d’école et à la reconnexion du même utilisateur", () => {
    const context = save()
    useAuthStore.getState().setUser({ ...user, tenantId: "other" })
    expect(readEnrollmentClassDraft(context)).toBeNull()
    useAuthStore.getState().setUser(user)
    expect(readEnrollmentClassDraft(context)).toBeNull()
    const sameUser = save()
    useAuthStore.getState().setUser(null)
    useAuthStore.getState().setUser(user)
    expect(readEnrollmentClassDraft(sameUser)).toBeNull()
  })

  it("expire au bout de trente minutes sans persistance", () => {
    vi.useFakeTimers()
    try {
      const context = save()
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(readEnrollmentClassDraft(context)).toBeNull()
    } finally { vi.useRealTimers() }
  })

  it.each(["https://evil.test", "//evil.test", "/enrollments/new?parentPhone=2250700000000", "/enrollments/new#private", "/students", "/enrollments/invalid/edit"])("refuse un retour non autorisé : %s", (url) => {
    expect(isEnrollmentReturnUrl(url)).toBe(false)
    expect(() => saveEnrollmentClassDraft({ returnTo: url, schoolYearId: yearId, levelId, classId: "", form })).toThrow()
  })

  it("refuse la réutilisation de profil et accepte la modification d’un dossier", () => {
    expect(isEnrollmentReturnUrl(`/enrollments/new?studentId=${classId}`)).toBe(false)
    expect(isEnrollmentReturnUrl(`/enrollments/${classId}/edit`)).toBe(true)
  })
})

describe("revalidation du retour", () => {
  const years = [{ id: yearId, status: "active" }] as SchoolYear[]
  const levels = [{ id: levelId }] as Level[]
  const response = { activeSchoolYear: years[0], schoolYear: years[0], classes: [{ id: classId, isActive: true, level: { id: levelId }, schoolYear: { id: yearId } }] } as ClassesResponse
  const draft = () => readEnrollmentClassDraft({ ...save(), createdClassId: classId })!
  it("sélectionne la classe seulement après relecture des références", () => {
    expect(resolveEnrollmentClassReturn(draft(), years, levels, response).classId).toBe(classId)
  })
  it("conserve le dossier sans classe après annulation", () => {
    expect(resolveEnrollmentClassReturn(readEnrollmentClassDraft(save())!, years, levels, response)).toMatchObject({ classId: "", message: expect.stringContaining("annulée") })
  })
  it.each([
    ["année active changée", { ...response, activeSchoolYear: { ...years[0], id: classId } }, levels],
    ["classe supprimée", { ...response, classes: [] }, levels],
    ["classe inactive", { ...response, classes: [{ ...response.classes[0], isActive: false }] }, levels],
    ["niveau différent", { ...response, classes: [{ ...response.classes[0], level: { ...response.classes[0].level, id: classId } }] }, levels],
    ["année différente", { ...response, classes: [{ ...response.classes[0], schoolYear: { ...response.classes[0].schoolYear, id: classId } }] }, levels],
    ["niveau supprimé", response, []],
  ])("bloque le retour : %s", (_label, references, availableLevels) => {
    expect(resolveEnrollmentClassReturn(draft(), years, availableLevels, references)).toMatchObject({ classId: "", message: expect.any(String) })
  })
})
