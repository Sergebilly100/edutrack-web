import { expect, test, type Page } from "@playwright/test"

const yearId = "11111111-1111-4111-8111-111111111111"
const periodId = "22222222-2222-4222-8222-222222222222"

async function mockReview(page: Page) {
  const user = { id: "director-ux06", role: "director", name: "Direction Démo", phone: null,
    email: null, profilePhotoUrl: null, mustChangePassword: false }
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    const payload = path.endsWith("/auth/refresh")
      ? { accessToken: "token-ux06", tokenType: "Bearer", expiresIn: 3600, user }
      : path.endsWith("/auth/me")
        ? { user, tenant: { id: "tenant-ux06", status: "active", trialEndsAt: null } }
        : path.endsWith("/permissions/me")
          ? { permissions: ["evaluations.view", "school_years.view"] }
          : path.endsWith("/school/info")
            ? { onboarding_completed: true }
            : path.endsWith("/academic/evaluations/options")
              ? { schoolYears: [{ id: yearId, label: "2026-2027", active: true }],
                  gradingPeriods: [{ id: periodId, label: "Premier trimestre", schoolYearId: yearId,
                    isCurrent: true, isFuture: false, hasEvaluations: true }],
                  levels: [{ id: "level-1", label: "6e" }],
                  classes: [{ id: "class-1", label: "6e A", levelId: "level-1" }],
                  subjects: [{ id: "subject-1", label: "Mathématiques", levelId: "level-1" }],
                  teachers: [{ id: "teacher-1", label: "Professeur A" }] }
              : path.endsWith("/academic/evaluations")
                ? { items: [{ id: "evaluation-1", label: "Devoir 1", date: "2026-10-01",
                    type: "scheduled", coefficient: 2, expectedCount: 2, enteredCount: 1,
                    lastReminderAt: null, subject: { id: "subject-1", name: "Mathématiques" },
                    teacher: { id: "teacher-1", name: "Professeur A" },
                    class: { id: "class-1", name: "6e A" },
                    level: { id: "level-1", name: "6e" },
                    period: { id: periodId, name: "Premier trimestre" },
                    notes: [{ studentId: "student-1", studentName: "Kouassi Awa", score: 14,
                      maxScore: 20, comment: null }, { studentId: "student-2", studentName: "Koné Moussa",
                      score: null, maxScore: null, comment: null }] }],
                  summary: { evaluations: 1, grades: 1, missing: 1 },
                  policy: { graceDays: 7, lateDays: 14 }, page: 1, pageSize: 20, total: 1 }
                : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })
}

test("UX-06 : les quatre filtres, le tri et le survol des évaluations restent visibles", async ({ page }, testInfo) => {
  await mockReview(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/academic/evaluations")
  const filters = page.getByRole("region", { name: "Filtres" })
  const fields = ["Niveau", "Classe", "Matière", "Professeur"]
  const boxes = await Promise.all(fields.map(async (label) => {
    const field = filters.getByRole("combobox", { name: label })
    await expect(field).toBeVisible()
    return field.boundingBox()
  }))
  expect(boxes.every((box) => box && Math.abs(box.y - boxes[0]!.y) < 2)).toBe(true)

  const sort = page.getByRole("combobox", { name: "Trier et regrouper" })
  await expect(sort).toBeVisible()
  await expect(sort).toContainText("Retard")
  const card = page.getByRole("article").filter({ hasText: "Devoir 1" })
  await expect(card).toBeVisible()
  const before = await card.evaluate((element) => getComputedStyle(element).backgroundColor)
  await card.hover()
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(before)
  await testInfo.attach("evaluation-desktop", { body: await page.screenshot(), contentType: "image/png" })
})

test("UX-06 : les filtres et le tri restent utilisables sur mobile", async ({ page }, testInfo) => {
  await mockReview(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/academic/evaluations")
  await expect(page.getByRole("combobox", { name: "Trier et regrouper" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Devoir 1/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await testInfo.attach("evaluation-mobile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
})
