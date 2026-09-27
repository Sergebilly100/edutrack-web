import { expect, test, type APIResponse, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const api = () => process.env.E2E_API_URL!
async function checked(response: APIResponse) {
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function prepare(page: Page, canEdit: boolean) {
  // Authenticate through the UI, which uses the fixture tenant injected into Vite.
  await returningUser(page)
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill("2250701234567")
  await page.getByLabel("Mot de passe", { exact: true }).fill("director2024")
  const directorLogin = page.waitForResponse((result) => result.url().includes("/auth/login/") && result.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  const login = await checked(await directorLogin)
  await expect(page).toHaveURL(/\/dashboard$/)
  const headers = { authorization: `Bearer ${login.accessToken}` }
  const suffix = canEdit ? "autorise" : "restreint"
  const years = await checked(await page.request.get(`${api()}/school-years`, { headers }))
  const year = years.schoolYears.find((item: { status: string }) => item.status === "active")
  const { level } = await checked(await page.request.post(`${api()}/levels`, {
    headers, data: { name: `Niveau C12 ${suffix}`, orderIndex: canEdit ? 212 : 213, isExamClass: false },
  }))
  const klass = await checked(await page.request.post(`${api()}/classes`, {
    headers, data: { name: `Classe C12 ${suffix}`, levelId: level.id, expectedSchoolYearId: year.id },
  }))
  const student = await checked(await page.request.post(`${api()}/students`, {
    headers, data: { class_id: klass.class.id, first_name: "Test", last_name: "C12", matricule: `C12-${suffix}` },
  }))
  const { enrollment } = await checked(await page.request.post(`${api()}/enrollments`, {
    headers, data: { studentId: student.data.id, classId: klass.class.id, schoolYearId: year.id, type: "new_registration" },
  }))
  const email = `c12-${suffix}@example.test`
  const password = "CaisseC12!2026"
  const { user } = await checked(await page.request.post(`${api()}/permissions/users`, {
    headers, data: { name: `Caisse C12 ${suffix}`, email, password },
  }))
  const { position } = await checked(await page.request.post(`${api()}/permissions/positions`, {
    headers, data: { name: `Caisse C12 ${suffix}`, permissions: ["enrollments.confirm_payment", "enrollments.view", ...(canEdit ? ["tuition.edit"] : [])] },
  }))
  await checked(await page.request.post(`${api()}/permissions/positions/${position.id}/assign`, { headers, data: { userId: user.id } }))
  await page.context().clearCookies()
  await returningUser(page)
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill(email)
  await page.getByLabel("Mot de passe", { exact: true }).fill(password)
  const loggedIn = page.waitForResponse((result) => result.url().includes("/auth/login/") && result.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  expect((await loggedIn).status()).toBe(200)
  await expect(page).not.toHaveURL(/\/login$/)
  return { enrollment, year, level }
}

test("C12 : caisse avec tuition.edit seul, configuration persistée puis même paiement", async ({ page }, testInfo) => {
  const { enrollment, year, level } = await prepare(page, true)
  const paymentPath = `/enrollments/${enrollment.id}/payment`
  await page.goto(paymentPath)
  await expect(page.getByText(new RegExp(`Les frais du niveau ${level.name}`))).toBeVisible()
  await page.getByRole("link", { name: "Configurer les frais" }).click()
  await expect(page.getByRole("tab", { name: "Finance", exact: true })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("combobox", { name: "Année scolaire", exact: true })).toContainText(year.label)
  await expect(page.getByRole("combobox", { name: "Niveau", exact: true })).toContainText(level.name)
  await expect(page.getByLabel("Montant total annuel", { exact: true })).toHaveValue("")
  await page.getByLabel("Montant total annuel", { exact: true }).fill("120000")
  await page.getByLabel("Date seuil", { exact: true }).fill(new Date().toISOString().slice(0, 10))
  await page.getByLabel("Cumul attendu", { exact: true }).fill("120000")
  const saved = page.waitForResponse((result) => result.url().includes("/tuition-plans/levels/") && result.request().method() === "PUT")
  await page.getByRole("button", { name: "Enregistrer le plan", exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(page).toHaveURL(new RegExp(`${paymentPath}$`))
  await expect(page.getByLabel("Montant reçu *", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Montant reçu *", { exact: true })).toHaveValue("")
  await expect(page.getByText(/Les frais du niveau/)).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel("Montant reçu *", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("c12-payment-ready-mobile.png"), fullPage: true })
})

test("C12 : caisse sans tuition.edit, explication et aucun lien de configuration", async ({ page }) => {
  const { enrollment, level, year } = await prepare(page, false)
  await page.goto(`/enrollments/${enrollment.id}/payment`)
  await expect(page.getByText(new RegExp(`Les frais du niveau ${level.name}`))).toBeVisible()
  await expect(page.getByText(/Contactez le responsable habilité/)).toBeVisible()
  await expect(page.getByRole("link", { name: "Configurer les frais" })).toHaveCount(0)
  await expect(page.getByText(/Impossible de calculer/)).toHaveCount(0)
  const params = new URLSearchParams({ tab: "finance", schoolYearId: year.id, schoolYearLabel: year.label,
    levelId: level.id, levelName: level.name, enrollmentId: enrollment.id, returnTo: `/enrollments/${enrollment.id}/payment` })
  await page.goto(`/settings?${params}`)
  await expect(page.getByText(/Contactez le responsable habilité/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Enregistrer le plan", exact: true })).toHaveCount(0)
  await expect(page.getByLabel("Montant total annuel", { exact: true })).toHaveCount(0)
})
