import { expect, test } from "@playwright/test"

import { loginAsDirectorUI } from "../director/helpers"

test.describe("Souscriptions - création", () => {
  test("flow modal création abonnement parent", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/subscriptions")

    await page.getByRole("button", { name: "Nouvel abonnement" }).click()
    await expect(page.getByRole("dialog", { name: "Nouvel abonnement parent" })).toBeVisible()

    await page.getByLabel("Nom complet").fill("Parent Modal Test")
    await page.getByLabel("Téléphone").fill("0700")
    await expect(page.getByText("Format requis: 225 + 10 chiffres.")).toBeVisible()

    const uniquePhone = `22507${Date.now().toString().slice(-8)}`
    await page.getByLabel("Téléphone").fill(uniquePhone)
    await page.getByRole("button", { name: "Continuer" }).click()

    await page.getByRole("dialog").getByRole("checkbox").first().click()

    await page.getByRole("combobox").last().click()
    await page.getByRole("option", { name: "2 mois" }).click()

    await expect(page.getByText(/1 élève\(s\).*2 mois/)).toBeVisible()
    await page.getByRole("button", { name: "Continuer" }).click()

    await page.getByRole("button", { name: "Créer l'abonnement" }).click()

    await expect(page.getByText("Accès parent")).toBeVisible()

    await page.evaluate(() => {
      Object.assign(navigator, {
        clipboard: { writeText: () => Promise.resolve() },
      })
    })

    await page.getByRole("button", { name: "Copier les accès" }).click()
    await page.getByRole("button", { name: "Fermer" }).click()

    await expect(page.getByText(uniquePhone)).toBeVisible()
  })
})
