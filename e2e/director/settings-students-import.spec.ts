import { expect, test } from "@playwright/test"

import { loginAsDirectorUI } from "./helpers"

test.describe("Directeur - settings/students/import", () => {
  test("navigation vers la page élèves", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Élèves" }).click()

    await expect(page).toHaveURL(/\/students/)
    await expect(page.getByRole("tab", { name: "Liste" })).toBeVisible()
  })

  test("navigation vers la page paramètres", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Paramètres" }).click()

    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByText("Paramètres école")).toBeVisible()
    await expect(page.getByText("Informations école")).toBeVisible()
  })

  test("navigation vers la page import", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Import" }).click()

    await expect(page).toHaveURL(/\/import/)
    await expect(page.getByRole("heading", { name: "Import de données" })).toBeVisible()
    await expect(page.getByText("Historique des imports")).toBeVisible()
  })
})
