import { expect, test, type Page } from "@playwright/test"
import { mockDirectorAuth } from "../director/helpers"

const enrollmentId = "550e8400-e29b-41d4-a716-446655440001"
const context = { schoolYearId: "550e8400-e29b-41d4-a716-446655440002", schoolYearLabel: "2026-2027", levelId: "550e8400-e29b-41d4-a716-446655440003", levelName: "Sixième" }
const otherYear = "550e8400-e29b-41d4-a716-446655440004"
const otherLevel = "550e8400-e29b-41d4-a716-446655440005"
const paymentPath = `/enrollments/${enrollmentId}/payment`

async function fixture(page: Page, options: { saveFails?: boolean; summaryFails?: boolean; saveGate?: Promise<void>; summaryGate?: Promise<void> } = {}) {
  let applicable = false
  await page.route("**/api/v1/**", (route) => route.fulfill({ json: { data: [], total: 0 } }))
  await mockDirectorAuth(page)
  const replies = {
    "settings/sms-price": { is_enabled: false, monetize_parent_alerts: false },
    "permissions/config": { school: { name: "École test", plan: "pro" }, users: [], positions: [], limits: {} },
    "school-years": { schoolYears: [{ id: otherYear, label: "2025-2026", status: "active" }, { id: context.schoolYearId, label: context.schoolYearLabel, status: "draft" }] },
    "levels": { levels: [{ id: otherLevel, name: "Cinquième" }, { id: context.levelId, name: context.levelName }] },
    "tuition-plans": { tuitionPlans: [] },
  }
  for (const [path, json] of Object.entries(replies)) await page.route(`**/api/v1/${path}*`, (route) => route.fulfill({ json }))
  await page.route(`**/api/v1/enrollments/${enrollmentId}/payment-summary`, async (route) => {
    if (applicable) await options.summaryGate
    if (!applicable || options.summaryFails) return route.fulfill({ status: 409, json: { error: "Frais requis", code: "TUITION_PLAN_REQUIRED", statusCode: 409, context } })
    await route.fulfill({ json: { enrollment: { id: enrollmentId, studentId: "student", className: "Sixième A", schoolYearId: context.schoolYearId, schoolYearLabel: context.schoolYearLabel, status: "pending_cashier" }, amountDue: 120000, totalDue: 120000, confirmedPaid: 0, currency: "FCFA" } })
  })
  await page.route("**/api/v1/tuition-plans/levels/*", async (route) => {
    const payload = route.request().postDataJSON()
    const levelId = new URL(route.request().url()).pathname.split("/").pop()
    await options.saveGate
    if (options.saveFails) return route.fulfill({ status: 403, json: { error: "Permission denied", code: "FORBIDDEN", statusCode: 403 } })
    applicable = payload.schoolYearId === context.schoolYearId && levelId === context.levelId
    await route.fulfill({ json: { tuitionPlan: { id: "plan", level_id: levelId, school_year_id: payload.schoolYearId, total_amount: payload.totalAmount, currency: "FCFA", schedule_steps: payload.scheduleSteps } } })
  })
}

async function openRecovery(page: Page) {
  await page.goto(paymentPath)
  await page.getByRole("link", { name: "Configurer les frais" }).click()
  await expect(page.getByRole("combobox", { name: "Année scolaire", exact: true })).toContainText(context.schoolYearLabel)
  await expect(page.getByRole("combobox", { name: "Niveau", exact: true })).toContainText(context.levelName)
  await expect(page.getByLabel("Montant total annuel")).toHaveValue("")
}

async function fillPlan(page: Page) {
  await page.getByLabel("Montant total annuel").fill("120000")
  await page.getByLabel("Date seuil", { exact: true }).fill("2026-10-01")
  await page.getByLabel("Cumul attendu", { exact: true }).fill("120000")
}

for (const field of ["year", "level"] as const) {
  test(`C12 : un plan ${field === "year" ? "d’une autre année" : "d’un autre niveau"} ne déclenche aucun retour`, async ({ page }) => {
    await fixture(page)
    await openRecovery(page)
    await page.getByRole("combobox", { name: field === "year" ? "Année scolaire" : "Niveau", exact: true }).click()
    await page.getByRole("option", { name: field === "year" ? /2025-2026/ : "Cinquième" }).click()
    await fillPlan(page)
    const saved = page.waitForResponse((response) => response.request().method() === "PUT")
    await page.getByRole("button", { name: "Enregistrer le plan", exact: true }).click()
    expect((await saved).status()).toBe(200)
    await expect(page.getByText("Plan de frais enregistré", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/settings\?/)
    await page.goto(paymentPath)
    await expect(page.getByRole("link", { name: "Configurer les frais" })).toBeVisible()
  })
}

test("C12 : un refus de sauvegarde reste affiché sans retour ni endpoint de repli", async ({ page }) => {
  await fixture(page, { saveFails: true })
  await openRecovery(page)
  await fillPlan(page)
  const writes: string[] = []
  page.on("request", (request) => { if (request.method() === "PUT" || request.method() === "POST") writes.push(request.url()) })
  await page.getByRole("button", { name: "Enregistrer le plan", exact: true }).click()
  await expect(page.getByText("Enregistrement impossible", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/settings\?/)
  expect(writes).toHaveLength(1)
  expect(writes[0]).toContain(`/tuition-plans/levels/${context.levelId}`)
})

test("C12 : la sauvegarde réussie ne masque pas un paiement encore refusé par le serveur", async ({ page }) => {
  await fixture(page, { summaryFails: true })
  await openRecovery(page)
  await fillPlan(page)
  await page.getByRole("button", { name: "Enregistrer le plan", exact: true }).click()
  await expect(page.getByText("Paiement à vérifier", { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page).toHaveURL(/\/settings\?/)
})

for (const phase of ["save", "summary"] as const) {
  test(`C12 : quitter Finance pendant ${phase} annule le retour automatique`, async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    await fixture(page, phase === "save" ? { saveGate: gate } : { summaryGate: gate })
    await openRecovery(page)
    await fillPlan(page)
    const pending = page.waitForRequest((request) => phase === "save"
      ? request.method() === "PUT" : request.url().endsWith("/payment-summary"))
    await page.getByRole("button", { name: "Enregistrer le plan", exact: true }).click()
    await pending
    await page.getByRole("tab", { name: "Scolarité", exact: true }).click()
    await expect(page).toHaveURL(/tab=scolarite/)
    const finished = page.waitForResponse((response) => phase === "save"
      ? response.request().method() === "PUT" : response.url().endsWith("/payment-summary"))
    release()
    await finished
    await expect(page.getByRole("tab", { name: "Scolarité", exact: true })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("button", { name: "Enregistrer le plan", exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/tab=scolarite/)
  })
}

test("C12 : accès normal aux paramètres Finance conservé", async ({ page }) => {
  await fixture(page)
  await page.goto("/settings?tab=finance")
  await expect(page.getByRole("combobox", { name: "Année scolaire", exact: true })).toContainText("2025-2026")
  await expect(page.getByRole("combobox", { name: "Niveau", exact: true })).toContainText("Cinquième")
  await fillPlan(page)
  await page.getByRole("button", { name: "Enregistrer le plan", exact: true }).click()
  await expect(page.getByText("Plan de frais enregistré", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/settings\?tab=finance$/)
})
