import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

test.describe("Parent portal flow", () => {
  test.use({ storageState: "e2e/.auth/parent.json" })

  test("dashboard, absences et compte", async ({ page }) => {
    await returningUser(page)
    await page.goto("/parent/dashboard")
    await expect(page).toHaveURL(/\/parent\/dashboard$/)
    await expect(page.getByRole("heading", { name: "Présence aujourd'hui" })).toBeVisible()
    await expect(page.getByText("Absences cette semaine")).toBeVisible()
    await expect(page.getByText("Taux d'absence ce mois")).toBeVisible()

    await page.getByRole("link", { name: "Absences", exact: true }).click()
    await expect(page).toHaveURL(/\/parent\/absences/)
    await expect(page.getByRole("heading", { name: /Historique des absences/ })).toBeVisible()

    await page.getByRole("link", { name: "Compte", exact: true }).click()
    await expect(page).toHaveURL(/\/parent\/account/)
    await expect(page.getByText("Mon compte", { exact: true })).toBeVisible()

    const currentPassword = process.env.E2E_PARENT_PASSWORD!
    await page.getByLabel("Mot de passe actuel").fill(currentPassword)
    await page.getByLabel("Nouveau mot de passe").fill("Parent1234!")
    await page.getByLabel("Confirmer le mot de passe").fill("Parent1234!")
    await page.getByRole("button", { name: "Enregistrer" }).click()
    await expect(page.getByText("Mot de passe mis à jour").first()).toBeVisible()
  })
})
