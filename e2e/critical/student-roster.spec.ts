import { expect, test, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

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

for (const device of [{ name: "Android", width: 360, height: 800, mobile: true }, { name: "bureau", width: 1280, height: 900, mobile: false }]) {
  test.describe(device.name, () => {
    test.use({ viewport: { width: device.width, height: device.height }, isMobile: device.mobile, hasTouch: device.mobile })
    test("nouveau profil → dossier en attente → premier versement → liste et fiche", async ({ page }) => {
      const token = await login(page)
      const headers = { authorization: `Bearer ${token}` }
      const api = process.env.E2E_API_URL!
      const lastName = `Historique roster ${device.name}`
      const matricule = `ROSTER-${device.name}`
      // Prime the school list cache before enrollment; payment must refresh it.
      await page.goto("/students")
      await expect(page.getByText(`${lastName} Aya`, { exact: true })).toHaveCount(0)
      await page.goto("/enrollments")
      await page.getByRole("link", { name: "Nouvelle inscription" }).click()
      await page.getByLabel("Prénom *", { exact: true }).fill("Aya")
      await page.getByLabel("Nom *", { exact: true }).fill(lastName)
      await page.getByLabel("Matricule (facultatif)").fill(matricule)
      await page.getByLabel("Nom du parent", { exact: true }).fill("Parent recette")
      await page.getByLabel("Téléphone", { exact: true }).fill("2250700007711")
      await page.getByLabel("Nom du second parent", { exact: true }).fill("Second parent recette")
      await page.getByLabel("Second téléphone", { exact: true }).fill("2250100007711")
      await expect(page.getByText(/Année scolaire active QA \d{4}/)).toBeVisible()
      await page.getByRole("combobox", { name: "Niveau visé" }).click()
      await page.getByRole("option", { name: "Niveau QA", exact: true }).click()
      await page.getByRole("combobox", { name: "Classe visée *" }).click()
      await page.getByRole("option", { name: /Classe inscription QA/ }).click()
      const dossierResponse = page.waitForResponse((result) => result.url().endsWith("/enrollments") && result.request().method() === "POST")
      await page.getByRole("button", { name: "Créer et continuer" }).click()
      const dossier = await dossierResponse
      expect(dossier.status()).toBe(201)
      const enrollment = (await dossier.json()).enrollment as { studentId: string; status: string }
      expect(enrollment).toMatchObject({ status: "pending_cashier" })
      const studentId = enrollment.studentId
      await page.getByRole("button", { name: "Terminer le dossier" }).click()
      await expect(page).toHaveURL(/\/enrollments$/)
      const beforePayment = await page.request.get(`${api}/students`, { headers, params: { search: matricule } })
      expect((await beforePayment.json()).pagination.total).toBe(0)
      await page.getByRole("row", { name: new RegExp(lastName) }).getByRole("link", { name: "Caisse" }).click()
      await page.getByLabel("Montant reçu *").fill("10000")
      await page.getByLabel("Référence du reçu de caisse *").fill(`RC-${matricule}`)
      await page.getByRole("button", { name: /Enregistrer 10/ }).click()
      await expect(page).toHaveURL(/\/enrollments$/)
      await page.goto("/students")
      const rosterEntry = device.mobile
        ? page.getByRole("button", { name: new RegExp(lastName) })
        : page.getByRole("table").getByText(`${lastName} Aya`, { exact: true })
      await rosterEntry.click()
      await expect(page).toHaveURL(new RegExp(`/students/${studentId}\\?returnTo=`))
      await expect(page.getByRole("heading", { name: "Profil détaillé élève" })).toBeVisible()
      await expect(page.getByRole("heading", { name: `${lastName} Aya`, exact: true })).toBeVisible()
      await expect(page.getByText("Élève introuvable.")).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  })
}
