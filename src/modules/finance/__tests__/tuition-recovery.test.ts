import { describe, expect, it } from "vitest"
import { getMissingTuition, planResolvesRecovery, readTuitionRecovery, safePaymentReturn, tuitionSettingsUrl } from "../tuition-recovery"
import type { TuitionPlan } from "../finance.api"
import { ApiError } from "@/shared/api/client"

const enrollmentId = "550e8400-e29b-41d4-a716-446655440001"
const context = { schoolYearId: "550e8400-e29b-41d4-a716-446655440002", schoolYearLabel: "2026-2027", levelId: "550e8400-e29b-41d4-a716-446655440003", levelName: "Sixième" }
const returnTo = `/enrollments/${enrollmentId}/payment`
const recovery = { ...context, enrollmentId, returnTo }

describe("retour caisse après configuration des frais", () => {
  it("transporte uniquement le contexte serveur vers Finance et le même dossier", () => {
    const url = tuitionSettingsUrl(context, enrollmentId)!
    expect(url.startsWith("/settings?")).toBe(true)
    expect(readTuitionRecovery(new URLSearchParams(url.split("?")[1]))).toEqual(recovery)
    expect(safePaymentReturn(returnTo, enrollmentId)).toBe(returnTo)
  })

  it.each([
    "https://autre-ecole.ivoiredu.ci" + returnTo,
    "//autre-ecole.ivoiredu.ci" + returnTo,
    "javascript:alert(1)", "/settings?tab=finance", "/enrollments/550e8400-e29b-41d4-a716-446655440009/payment",
    returnTo + "?tenant=autre", returnTo + "#autre", "/enrollments/../settings", "/\\evil.test",
    encodeURIComponent(returnTo), null,
  ])("rejette une URL de retour hors dossier ou non canonique : %s", (url) => {
    expect(safePaymentReturn(url, enrollmentId)).toBeNull()
    const params = new URLSearchParams({ tab: "finance", ...context, enrollmentId, returnTo: url ?? "" })
    expect(readTuitionRecovery(params)).toBeNull()
  })

  it("rejette les contextes incomplets et les identifiants invalides", () => {
    const params = new URLSearchParams({ tab: "finance", ...recovery })
    params.delete("levelId")
    expect(readTuitionRecovery(params)).toBeNull()
    expect(tuitionSettingsUrl(context, "bad/id")).toBeNull()
    params.set("levelId", context.levelId)
    params.set("tab", "general")
    expect(readTuitionRecovery(params)).toBeNull()
  })

  it("reconnaît l’erreur métier même si son contexte est incomplet, sans inventer de valeurs", () => {
    const error = (data: unknown) => ({ isAxiosError: true, response: { data } })
    expect(getMissingTuition(error({ code: "TUITION_PLAN_REQUIRED", context }))).toEqual({ context })
    expect(getMissingTuition(new ApiError("Frais requis", { code: "TUITION_PLAN_REQUIRED", cause: error({ code: "TUITION_PLAN_REQUIRED", context }) }))).toEqual({ context })
    expect(getMissingTuition(error({ code: "TUITION_PLAN_REQUIRED" }))).toEqual({})
    expect(getMissingTuition(error({ code: "FORBIDDEN" }))).toBeNull()
    expect(getMissingTuition(new Error("network"))).toBeNull()
  })

  it.each([
    [context.schoolYearId, context.levelId, 120000, true],
    ["other-year", context.levelId, 120000, false],
    [context.schoolYearId, "other-level", 120000, false],
    [context.schoolYearId, context.levelId, 0, false],
  ])("ne reprend que le plan applicable (%s, %s, %i)", (schoolYearId, levelId, totalAmount, expected) => {
    const plan: TuitionPlan = { id: "plan", schoolYearId, levelId, totalAmount, currency: "FCFA", schoolYearLabel: "", levelName: "", scheduleSteps: [] }
    expect(planResolvesRecovery(plan, recovery)).toBe(expected)
  })
})
