import { expect, test } from "@playwright/test"

import { loginAsDirectorUI } from "../director/helpers"

test.describe("Souscriptions - création", () => {
  test("flow modal création abonnement parent (happy path)", async ({ page }) => {
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

    await page.getByLabel("Durée").fill("2")

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

  test("validation numéro de téléphone CI (format 225 + 10 chiffres)", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/subscriptions")

    await page.getByRole("button", { name: "Nouvel abonnement" }).click()

    await page.getByLabel("Nom complet").fill("Parent Validation")

    // Numéro trop court
    await page.getByLabel("Téléphone").fill("225070")
    await expect(page.getByText("Format requis: 225 + 10 chiffres.")).toBeVisible()

    // Numéro sans préfixe 225
    await page.getByLabel("Téléphone").fill("0700000000000")
    await expect(page.getByText("Format requis: 225 + 10 chiffres.")).toBeVisible()

    // Numéro valide → bouton Continuer actif
    const uniquePhone = `22501${Date.now().toString().slice(-8)}`
    await page.getByLabel("Téléphone").fill(uniquePhone)
    await expect(page.getByRole("button", { name: "Continuer" })).toBeEnabled()
  })

  test("fermeture du modal remet le formulaire à zéro", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/subscriptions")

    await page.getByRole("button", { name: "Nouvel abonnement" }).click()
    await page.getByLabel("Nom complet").fill("Parent À Effacer")
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Nouvel abonnement" }).click()
    const nameInput = page.getByLabel("Nom complet")
    await expect(nameInput).toHaveValue("")
  })
})

test.describe("Souscriptions - annulation", () => {
  test("annulation d'un abonnement actif via le menu déroulant", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/subscriptions")

    const activeRow = page.locator("tr").filter({ hasText: "Actif" }).first()
    const hasActiveRow = await activeRow.count() > 0

    if (!hasActiveRow) {
      test.skip()
      return
    }

    await activeRow.getByRole("button", { name: /Actions/ }).click()
    await page.getByRole("menuitem", { name: "Annuler l'abonnement" }).click()

    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.getByRole("button", { name: "Annuler l'abonnement" }).click()

    await expect(page.getByText("Abonnement annulé")).toBeVisible()
  })
})

test.describe("Souscriptions - renouvellement", () => {
  test("modal de renouvellement s'ouvre et affiche le récapitulatif", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/subscriptions")

    const renewBtn = page.getByRole("button", { name: "Renouveler l'accès" }).first()
    const hasRenewBtn = await renewBtn.count() > 0

    if (!hasRenewBtn) {
      test.skip()
      return
    }

    await renewBtn.click()
    await expect(page.getByRole("dialog", { name: "Renouveler l'abonnement" })).toBeVisible()
    await expect(page.getByText("Projection")).toBeVisible()
    await expect(page.getByText("Montant total")).toBeVisible()

    await page.getByRole("button", { name: "Annuler" }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
  })
})
