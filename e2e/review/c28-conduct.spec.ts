import { expect, test, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const yearId = "11111111-1111-4111-8111-111111111111"
const classId = "22222222-2222-4222-8222-222222222222"
const levelId = "33333333-3333-4333-8333-333333333333"
const periodId = "44444444-4444-4444-8444-444444444444"
const studentId = "55555555-5555-4555-8555-555555555555"

type Role = "teacher" | "director" | "staff"

async function mockSession(page: Page, role: Role, canDecide: boolean, scopeState: { schoolYearStatus?: "draft" | "active" | "closed"; reviewOpen?: boolean; isClosed?: boolean; pendingCount?: number } = {}) {
  await returningUser(page)
  const user = { id: "user-c28", role, name: "Utilisateur C28", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false }
  const scope = {
    classId, className: "6e A", levelId, levelName: "6e", schoolYearId: yearId,
    schoolYearLabel: "2026-2027", gradingPeriodId: periodId, gradingPeriodLabel: "T1",
    studentCount: 1, pendingCount: 1, reviewOpen: true, isClosed: false, schoolYearStatus: "active", ...scopeState,
  }
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const payload = path.endsWith("/auth/refresh")
      ? { accessToken: "token-c28", tokenType: "Bearer", expiresIn: 3600, user }
      : path.endsWith("/auth/me")
        ? { user, tenant: { id: "tenant-c28", status: "active", trialEndsAt: null } }
        : path.endsWith("/permissions/me")
          ? { permissions: role === "teacher" ? [] : ["conduct.finalize", "students.view", "school_years.view"] }
          : path.endsWith("/school/info")
            ? { onboarding_completed: true }
            : path.endsWith("/conduct/teacher-actions")
              ? { teacherActions: role === "teacher" ? [{ classId, className: "6e A", gradingPeriodId: periodId, gradingPeriodLabel: "T1", pendingCount: 1 }] : [] }
              : path.endsWith("/conduct/decision-workspace")
                ? { decisionScopes: canDecide ? [scope] : [], decisionActions: canDecide && scope.schoolYearStatus === "active" && scope.reviewOpen && !scope.isClosed && scope.pendingCount > 0 ? [scope] : [] }
                : path.endsWith("/school-years")
                  ? { schoolYears: [{ id: yearId, label: "2026-2027", status: "active", startDate: "2026-09-01", endDate: "2027-08-31", endOfYearReviewStartDate: "2027-06-01" }] }
                  : path.endsWith(`/conduct/policy/${yearId}`)
                    ? { policy: { mode: "direction", coefficient: 1 } }
              : path.endsWith("/academic/teacher-context")
                ? { classes: [{ id: classId, name: "6e A", levelId, levelName: "6e", schoolYearId: yearId, schoolYearLabel: "2026-2027", isHomeroomTeacher: canDecide }], gradingPeriods: [
                    { id: periodId, schoolYearId: yearId, label: "T1", conductReviewOpen: true, notesEntryOpen: false, closedClassIds: [] },
                    { id: "66666666-6666-4666-8666-666666666666", schoolYearId: yearId, label: "T2", conductReviewOpen: false, notesEntryOpen: true, closedClassIds: [] },
                  ] }
                : path.endsWith("/conduct/inputs/scope")
                  ? { isAvailable: true, students: [{ studentId, fullName: "Aya Kouamé", matricule: "A1", input: null, isLocked: false }] }
                  : path.endsWith("/evaluations/scope")
                    ? { subjects: [], evaluations: [], completion: [] }
                  : path.endsWith("/conduct/decision-students")
                    ? { students: [{ id: studentId, fullName: "Aya Kouamé" }] }
                    : path.endsWith(`/conduct/students/${studentId}/overview`)
                      ? { student: { id: studentId, fullName: "Aya Kouamé", className: "6e A" }, gradingPeriod: { id: periodId, label: "T1" }, teacherInputs: [{ id: null, teacherId: "teacher-1", teacherName: "Mme Koné", subjectLabel: "Maths", note: null, observation: null, createdAt: null, isSubmitted: false }], inputSummary: { expectedCount: 1, submittedCount: 0, isComplete: false }, spontaneousEvaluations: [], finalGrade: null }
                      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })
}

test("C28 : professeur, Notes affiche Conduite et un badge mobile sans décision", async ({ page }, testInfo) => {
  await mockSession(page, "teacher", false)
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(`/academic/notes?tab=conduite&classId=${classId}&gradingPeriodId=${periodId}`)
  await expect(page.getByRole("tab", { name: "Conduite" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Décisions" })).toHaveCount(0)
  await expect(page.getByRole("navigation", { name: "Navigation professeur mobile" }).getByText("Notes")).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Navigation professeur mobile" }).getByLabel("1 avis de conduite à renseigner")).toBeVisible()
  await expect(page.getByText("Aya Kouamé")).toBeVisible()
  await page.getByText("Aya Kouamé").scrollIntoViewIfNeeded()
  await expect(page.getByText("Aya Kouamé")).toBeInViewport()
  await page.getByRole("tab", { name: "Conduite" }).focus()
  await page.keyboard.press("ArrowLeft")
  await expect(page.getByRole("tab", { name: "Moyennes" })).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("tab", { name: "Conduite" })).toBeFocused()
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await testInfo.attach(`notes-${width}`, { body: await page.screenshot(), contentType: "image/png" })
  }
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "6e A · T1 : 1 avis à renseigner" }).click()
  await expect(page).toHaveURL(/\/academic\/notes\?.*tab=conduite/)
  await page.goto(`/academic/conduct?classId=${classId}&gradingPeriodId=${periodId}`)
  await expect(page).toHaveURL(/\/academic\/notes\?.*tab=conduite/)
})

test("C28 : professeur principal, la décision reste possible sans avis", async ({ page }) => {
  await mockSession(page, "teacher", true)
  await page.goto(`/academic/notes?tab=decisions&classId=${classId}&gradingPeriodId=${periodId}`)
  await expect(page.getByRole("tab", { name: "Décisions" })).toBeVisible()
  await page.getByRole("button", { name: "Aya Kouamé" }).click()
  await expect(page.getByText("Les avis manquants ne bloquent pas la décision.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Arrêter la note" })).toBeVisible()
})

for (const role of ["director", "staff"] as const) {
  test(`C28 : ${role}, filtre la classe autorisée sur mobile`, async ({ page }, testInfo) => {
    await mockSession(page, role, true)
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto(`/academic/conduct?schoolYearId=${yearId}&levelId=${levelId}&classId=${classId}&gradingPeriodId=${periodId}`)
    await expect(page.getByRole("heading", { name: "Conduite" })).toBeVisible()
    await expect(page.getByText("0/1 décisions")).toBeVisible()
    await page.getByRole("button", { name: "Aya Kouamé" }).click()
    await expect(page.locator("li").filter({ hasText: "Mme Koné : Avis manquant" })).toBeVisible()
    for (const width of [320, 360, 393]) {
      await page.setViewportSize({ width, height: 800 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await testInfo.attach(`${role}-conduite-${width}`, { body: await page.screenshot(), contentType: "image/png" })
    }
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await expect(page.getByRole("link", { name: /Conduite.*1 décision de conduite à finaliser/ })).toBeVisible()
    await testInfo.attach(`${role}-tiroir-mobile`, { body: await page.screenshot(), contentType: "image/png" })
    await page.getByRole("link", { name: /Conduite.*1 décision de conduite à finaliser/ }).click()
    await expect(page).toHaveURL(/\/academic\/conduct$/)
    await page.goto(`/academic/conduct/decision?classId=${classId}&gradingPeriodId=${periodId}`)
    await expect(page).toHaveURL(/\/academic\/conduct\?classId=/)
  })
}

test("C29 : le menu direction attend une politique autorisée et une revue ouverte", async ({ page }) => {
  await mockSession(page, "director", false)
  await page.goto("/dashboard")
  await expect(page.getByRole("link", { name: /^Conduite/ })).toHaveCount(0)
  await page.goto("/academic/conduct")
  await expect(page).toHaveURL(/\/academic\/conduct$/)
  await expect(page.getByText("Aucune décision autorisée")).toBeVisible()
  await expect(page.getByRole("link", { name: "Ouvrir les paramètres de conduite" })).toBeVisible()
})

for (const [name, scopeState] of [
  ["année en préparation", { schoolYearStatus: "draft" }],
  ["revue à venir", { reviewOpen: false }],
  ["revue clôturée", { isClosed: true }],
] as const) {
  test(`C29 : le menu direction attend la bonne période (${name})`, async ({ page }) => {
    await mockSession(page, "director", true, scopeState)
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto("/dashboard")
    await expect(page.getByRole("link", { name: /^Conduite/ })).toHaveCount(0)
    await page.goto("/academic/conduct")
    await expect(page).toHaveURL(/\/academic\/conduct$/)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: /^Conduite/ })).toHaveCount(0)
  })
}

test("C29 : la conduite reste accessible pour corriger une décision pendant la revue", async ({ page }) => {
  await mockSession(page, "director", true, { pendingCount: 0 })
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto("/academic/conduct")
  await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
  await expect(page.getByRole("link", { name: "Conduite", exact: true })).toBeVisible()
})

test("C29 : direction, Paramètres Personnel conserve la politique à 320, 360 et 393 px", async ({ page }, testInfo) => {
  await mockSession(page, "director", true)
  await page.goto("/settings?tab=personnel")
  await expect(page.getByRole("tab", { name: "Personnel" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Responsable de la décision" })).toBeVisible()
  await expect(page.getByLabel("Coefficient annuel")).toHaveValue("1")
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await testInfo.attach(`personnel-${width}`, { body: await page.screenshot(), contentType: "image/png" })
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: "Académique" }).click()
  await expect(page.getByRole("link", { name: /^Conduite/ })).toBeVisible()
  await testInfo.attach("sidebar-desktop", { body: await page.screenshot(), contentType: "image/png" })
})

test("C29 : une erreur de décision laisse Notes et les avis accessibles", async ({ page }) => {
  await mockSession(page, "teacher", false)
  await page.route("**/api/v1/conduct/decision-workspace", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
      error: "Migration de conduite requise", code: "CONDUCT_MIGRATION_REQUIRED", statusCode: 503,
    }) })
  })
  await page.goto("/academic/notes?tab=decisions")
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Conduite" })).toBeVisible()
  await page.getByRole("tab", { name: "Conduite" }).click()
  await expect(page.getByText("Aya Kouamé")).not.toBeVisible()
  await page.goto(`/academic/notes?tab=conduite&classId=${classId}&gradingPeriodId=${periodId}`)
  await expect(page.getByText("Aya Kouamé")).toBeVisible()
})
