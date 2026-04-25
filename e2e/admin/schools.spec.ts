import { expect, test } from "@playwright/test"

import { createAdminApiAuth, createSchoolViaApi, loginAsAdminUI } from "./helpers"

const openSchoolsPage = async (page: import("@playwright/test").Page) => {
  await loginAsAdminUI(page)
  await page.getByRole("link", { name: "Écoles" }).first().click()
  await expect(page).toHaveURL(/\/admin\/schools(\/|\?|$)/)
}

test.describe("Console Super Admin - Écoles", () => {
  test.describe.configure({ mode: "serial" })

  test("la liste des écoles se charge", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    const created = await createSchoolViaApi(request, auth, "pro")

    await openSchoolsPage(page)
    await page.getByPlaceholder("Rechercher une école").fill(created.schoolName)

    await expect(page.getByRole("columnheader", { name: "École" })).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(created.schoolName) }).first()).toBeVisible()
  })

  test("la création d'une école via le modal fonctionne", async ({ page }) => {
    await openSchoolsPage(page)

    const uniq = Date.now()
    const schoolName = `E2E Admin School ${uniq}`

    await page.getByRole("button", { name: "Créer une école" }).click()
    const dialog = page.getByRole("dialog", { name: "Nouvelle école" })

    await expect(dialog).toBeVisible()
    await dialog.getByLabel("Nom", { exact: true }).fill(schoolName)
    await dialog.getByLabel("Sous-domaine").fill(`e2e-admin-${uniq}`)
    await dialog.getByLabel("Ville").fill("Abidjan")

    await dialog.getByRole("combobox").nth(0).click()
    await page.getByRole("option", { name: "Secondaire" }).click()

    await dialog.getByLabel("Nom complet").fill(`Directeur E2E ${uniq}`)
    await dialog.getByLabel("Téléphone").fill(`22507${String(uniq).slice(-8)}`)
    await dialog.getByLabel("Email (optionnel)").fill(`directeur.${uniq}@edutrack.ci`)
    await dialog.getByLabel("Année scolaire active").fill("2025-2026")

    await dialog.getByRole("combobox").nth(1).click()
    await page.getByRole("option", { name: "Pro" }).click()

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/v1/admin/schools") && response.request().method() === "POST"
    )

    await dialog.getByRole("button", { name: "Créer l'école" }).click()
    const response = await responsePromise

    expect(response.ok()).toBeTruthy()
    await expect(page.getByText("École créée avec succès", { exact: true }).first()).toBeVisible()
  })

  test("les credentials directeur sont affichés après création", async ({ page }) => {
    await openSchoolsPage(page)

    const uniq = Date.now()
    const directorName = `Directeur E2E ${uniq}`
    const directorPhone = `22507${String(uniq).slice(-8)}`

    await page.getByRole("button", { name: "Créer une école" }).click()
    const dialog = page.getByRole("dialog", { name: "Nouvelle école" })

    await dialog.getByLabel("Nom", { exact: true }).fill(`E2E Admin School ${uniq}`)
    await dialog.getByLabel("Sous-domaine").fill(`e2e-admin-${uniq}`)
    await dialog.getByLabel("Ville").fill("Abidjan")
    await dialog.getByRole("combobox").nth(0).click()
    await page.getByRole("option", { name: "Secondaire" }).click()
    await dialog.getByLabel("Nom complet").fill(directorName)
    await dialog.getByLabel("Téléphone").fill(directorPhone)
    await dialog.getByLabel("Année scolaire active").fill("2025-2026")

    await dialog.getByRole("button", { name: "Créer l'école" }).click()

    await expect(page).toHaveURL(/\/admin\/schools\/.+/)
    await page.getByRole("tab", { name: "Utilisateurs" }).click()

    await expect(page.getByText(`Nom: ${directorName}`, { exact: false })).toBeVisible()
    await expect(page.getByText(`Téléphone: ${directorPhone}`, { exact: false })).toBeVisible()

    const accessTitle = page.getByText("Accès responsable", { exact: true })
    if ((await accessTitle.count()) > 0) {
      await expect(accessTitle).toBeVisible()
      await expect(page.getByText(/Mot de passe:/)).toBeVisible()
    }
  })

  test("la navigation vers le détail école fonctionne", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    const created = await createSchoolViaApi(request, auth)

    await openSchoolsPage(page)
    await page.getByPlaceholder("Rechercher une école").fill(created.schoolName)

    const row = page.locator("tbody tr").filter({ hasText: created.schoolName }).first()
    await expect(row).toBeVisible()

    await row.getByRole("button", { name: "Voir détail" }).click({ force: true })

    await expect(page).toHaveURL(/\/admin\/schools\/.+/)
    await expect(page.getByText("Configuration école", { exact: true })).toBeVisible()
  })

  test("la modification du plan d'une école est sauvegardée", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    const created = await createSchoolViaApi(request, auth, "essential")

    await openSchoolsPage(page)
    await page.getByPlaceholder("Rechercher une école").fill(created.schoolName)

    const row = page.locator("tbody tr").filter({ hasText: created.schoolName }).first()
    await expect(row).toBeVisible()

    await row.getByRole("button", { name: "Config" }).click({ force: true })
    await expect(page).toHaveURL(/\/admin\/schools\/.+/)

    const planCombobox = page.getByText("Plan", { exact: true }).locator("..").getByRole("combobox")
    await planCombobox.click()
    await page.getByRole("option", { name: "pro", exact: true }).click()

    await page.getByRole("button", { name: "Enregistrer la configuration" }).click()

    await expect(page.getByText("Configuration école mise à jour", { exact: true }).first()).toBeVisible()
    await expect(planCombobox).toContainText("pro")
  })
})
