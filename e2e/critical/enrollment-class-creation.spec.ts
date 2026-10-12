import { expect, test, type Page } from "@playwright/test"
import { navigateMenu, returningUser } from "../ui-helpers"

const api = () => process.env.E2E_API_URL!
async function login(page: Page) {
  await returningUser(page)
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill("2250701234567")
  await page.getByLabel("Mot de passe", { exact: true }).fill("director2024")
  const response = page.waitForResponse((result) => result.url().includes("/auth/login/") && result.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  const result = await response
  expect(result.status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard$/)
  return (await result.json()).accessToken as string
}
async function startEnrollment(page: Page, suffix: string) {
  await navigateMenu(page, "Vie scolaire", "Inscriptions")
  await page.getByRole("link", { name: "Nouvelle inscription" }).click()
  await page.getByLabel("Prénom *", { exact: true }).fill("Aya C9")
  await page.getByLabel("Nom *", { exact: true }).fill(suffix)
  await page.getByLabel("Matricule (facultatif)").fill(`C9-${suffix}`)
  await expect(page.getByText(/Année scolaire active QA \d{4}/)).toBeVisible()
  await page.getByRole("combobox", { name: "Niveau visé" }).click()
  await page.getByRole("option", { name: "Niveau QA", exact: true }).click()
  await page.getByRole("button", { name: "Créer une classe", exact: true }).click()
  await expect(page).toHaveURL(/\/academic\/classes$/)
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Niveau", exact: true })).toContainText("Niveau QA")
}

for (const device of [
  { name: "Android320", width: 320, height: 760, mobile: true },
  { name: "Android360", width: 360, height: 800, mobile: true },
  { name: "Android393", width: 393, height: 851, mobile: true },
  { name: "bureau", width: 1280, height: 900, mobile: false },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: { width: device.width, height: device.height }, isMobile: device.mobile, hasTouch: device.mobile })
    test("C9 : création explicite, retour au même dossier et confirmation", async ({ page }) => {
      await login(page)
      const suffix = `Recette-${device.name}`
      await startEnrollment(page, suffix)
      expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain("Aya C9")
      expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain(suffix)
      const className = `Classe C9 ${device.name}`
      await page.getByLabel("Libellé de la classe", { exact: true }).fill(className)
      const createdResponse = page.waitForResponse((result) => result.url().endsWith("/classes") && result.request().method() === "POST")
      await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
      const created = await createdResponse
      expect(created.status()).toBe(201)
      const schoolClass = (await created.json()).class
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(page.getByText("Classe ajoutée", { exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Retour à l’inscription", exact: true }).click()
      await expect(page).toHaveURL(/\/enrollments\/new$/)
      await expect(page.getByLabel("Prénom *", { exact: true })).toHaveValue("Aya C9")
      await expect(page.getByLabel("Nom *", { exact: true })).toHaveValue(suffix)
      await expect(page.getByRole("combobox", { name: "Classe visée *" })).toContainText(className)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const enrollmentResponse = page.waitForResponse((result) => result.url().endsWith("/enrollments") && result.request().method() === "POST")
      await page.getByRole("button", { name: "Créer et continuer" }).click()
      const enrolled = await enrollmentResponse
      expect(enrolled.status()).toBe(201)
      expect((await enrolled.json()).enrollment).toMatchObject({ classId: schoolClass.id, schoolYearId: schoolClass.schoolYear.id })
      await page.getByRole("button", { name: "Terminer le dossier" }).click()
      await expect(page).toHaveURL(/\/enrollments$/)
      const row = page.getByRole("row", { name: new RegExp(suffix) })
      await row.getByRole("link", { name: "Caisse" }).click()
      await page.getByLabel("Montant reçu *").fill("25000")
      await page.getByLabel("Référence du reçu de caisse *").fill(`RC-C9-${device.name}`)
      const confirmed = page.waitForResponse((result) => result.url().endsWith("/confirm-payment") && result.request().method() === "POST")
      await page.getByRole("button", { name: /Enregistrer 25/ }).click()
      const response = await confirmed
      expect(response.status()).toBe(200)
      expect((await response.json()).enrollment).toMatchObject({ status: "confirmed", classId: schoolClass.id })
      await expect(page).toHaveURL(/\/enrollments$/)
      await expect(page.getByRole("row", { name: new RegExp(suffix) })).toContainText("Confirmée")
      await navigateMenu(page, "Académique", "Structure scolaire")
      await page.getByRole("tab", { name: "Classes", exact: true }).click()
      if (device.mobile) {
        await expect(page.getByRole("listitem").filter({ hasText: className })).toContainText("1 élève confirmé")
      } else {
        await expect(page.getByRole("row", { name: new RegExp(className) }).getByRole("cell", { name: "1", exact: true })).toBeVisible()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByRole("button", { name: "Retour à l’inscription", exact: true })).toHaveCount(0)
    })
  })
}

test("C9 : abandon et actualisation sans mutation implicite", async ({ page }) => {
  const token = await login(page)
  const headers = { authorization: `Bearer ${token}` }
  const beforeClasses = await (await page.request.get(`${api()}/classes`, { headers })).json()
  const beforeEnrollments = await (await page.request.get(`${api()}/enrollments`, { headers })).json()
  await startEnrollment(page, "Abandon")
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await page.getByRole("button", { name: "Retour à l’inscription", exact: true }).click()
  await expect(page.getByLabel("Prénom *", { exact: true })).toHaveValue("Aya C9")
  await expect(page.getByRole("button", { name: "Créer et continuer" })).toBeDisabled()
  await page.getByRole("button", { name: "Créer une classe", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.reload()
  await expect(page.getByText(/contexte d’inscription n’est plus disponible/)).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Retour à l’inscription", exact: true })).toHaveCount(0)
  const afterClasses = await (await page.request.get(`${api()}/classes`, { headers })).json()
  const afterEnrollments = await (await page.request.get(`${api()}/enrollments`, { headers })).json()
  expect(afterClasses.classes.length).toBe(beforeClasses.classes.length)
  expect(afterEnrollments.pagination.total).toBe(beforeEnrollments.pagination.total)
})
