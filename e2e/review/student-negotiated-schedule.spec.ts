import { expect, test, type Page } from "@playwright/test"

import { mockDirectorAuth } from "../director/helpers"

const yearId = "550e8400-e29b-41d4-a716-446655440002"
const studentId = "550e8400-e29b-41d4-a716-446655440003"

async function fixture(page: Page) {
  await page.route("**/api/v1/**", (route) => route.fulfill({ json: { data: [], total: 0 } }))
  await mockDirectorAuth(page)

  const replies: Record<string, unknown> = {
    "settings/sms-price": { is_enabled: false, monetize_parent_alerts: false },
    "permissions/config": { school: { name: "École test", plan: "pro" }, users: [], positions: [], limits: {} },
    "school-years": { schoolYears: [{ id: yearId, label: "2026-2027", status: "active" }] },
    "levels": { levels: [{ id: "level-6e", name: "Sixième" }] },
    "tuition-plans": { tuitionPlans: [{ id: "plan-6e", level_id: "level-6e", level_name: "Sixième", school_year_id: yearId, total_amount: "100000", currency: "FCFA", schedule_steps: [] }] },
    "students/financial-profiles": { data: [{ id: studentId, classId: "class-6e", className: "Sixième A", firstName: "Awa", lastName: "Koné", matricule: "MAT-001", birthDate: null, parentPhone: null, parentEmail: null, parentPhone2: null, isActive: true, createdAt: "2026-09-01T00:00:00.000Z" }], pagination: { page: 1, limit: 8, total: 1, totalPages: 1 } },
    [`tuition/student-schedules/${studentId}`]: { agreement: null, totalTuitionAmount: 100000, currency: "FCFA" },
  }
  for (const [path, json] of Object.entries(replies)) {
    await page.route(`**/api/v1/${path}*`, (route) => route.fulfill({ json }))
  }
}

for (const width of [320, 360, 393]) {
  test(`C44 : l’échéancier négocié reste utilisable à ${width}px`, async ({ page }) => {
    await fixture(page)
    await page.setViewportSize({ width, height: 850 })
    await page.goto("/settings?tab=finance")

    await expect(page.getByText("Échéancier négocié", { exact: true })).toBeVisible()
    const studentSearch = page.getByRole("combobox", { name: "Rechercher un élève confirmé" })
    await studentSearch.fill("Awa")
    await page.getByRole("option", { name: /Koné Awa/ }).click()
    await expect(page.getByText("Total de scolarité à couvrir", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Montant de l’échéance", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Enregistrer l’accord", exact: true })).toBeDisabled()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test("C44 : les montants, le motif et la confirmation sont requis avant la sauvegarde", async ({ page }) => {
  await fixture(page)
  await page.setViewportSize({ width: 393, height: 850 })
  let savedPayload: unknown
  await page.route(`**/api/v1/tuition/student-schedules/${studentId}`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { agreement: null, totalTuitionAmount: 100000, currency: "FCFA" } })
    savedPayload = route.request().postDataJSON()
    await route.fulfill({ json: { agreement: { id: "agreement-1", reason: "Accord parent documenté", updated_at: "2026-10-01T00:00:00.000Z", schedule_steps: [{ due_date: "2026-10-10", cumulative_amount_expected: "40000" }, { due_date: "2026-11-10", cumulative_amount_expected: "100000" }] }, totalTuitionAmount: 100000, currency: "FCFA" } })
  })
  await page.goto("/settings?tab=finance")
  await page.getByRole("combobox", { name: "Rechercher un élève confirmé" }).fill("Awa")
  await page.getByRole("option", { name: /Koné Awa/ }).click()
  await page.getByLabel("Motif de l’accord").fill("Accord parent documenté")
  await page.getByLabel("Date d’échéance", { exact: true }).fill("2026-10-10")
  await page.getByLabel("Montant de l’échéance", { exact: true }).fill("40000")
  await page.getByRole("button", { name: "Ajouter", exact: true }).click()
  await page.getByLabel("Date d’échéance", { exact: true }).nth(1).fill("2026-11-10")
  await page.getByLabel("Montant de l’échéance", { exact: true }).nth(1).fill("60000")
  await expect(page.locator("p").filter({ hasText: "Cumul calculé" }).last()).toContainText("100")
  await page.getByRole("button", { name: "Enregistrer l’accord", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Confirmer l’échéancier négocié ?" })).toBeVisible()
  await page.getByRole("button", { name: "Confirmer l’accord", exact: true }).click()
  await expect(page.getByText("Échéancier négocié enregistré", { exact: true })).toBeVisible()
  expect(savedPayload).toEqual({ schoolYearId: yearId, reason: "Accord parent documenté", installments: [
    { dueDate: "2026-10-10", amount: 40000 },
    { dueDate: "2026-11-10", amount: 60000 },
  ] })
})
