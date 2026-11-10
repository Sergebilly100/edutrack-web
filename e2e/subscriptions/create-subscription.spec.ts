import { expect, test } from "@playwright/test"
import { loginAsDirectorUI } from "../director/helpers"
import { navigateMenu, returningUser } from "../ui-helpers"

// Real API/database. Each mutation targets this test's own newly created parent.
test.beforeEach(async ({ page }) => {
  await returningUser(page)
  await loginAsDirectorUI(page)
  await navigateMenu(page, "Abonnements", "Abonnements parents")
  await page.getByRole("button", { name: "Nouvel abonnement", exact: true }).click()
  await page.getByRole("button", { name: "Ajouter un autre parent" }).click()
})

test("F31 : crée, annule avec motif puis renouvelle un abonnement persistant", async ({ page }) => {
  const phone = "2250700008877"
  const dialog = page.getByRole("dialog", { name: "Nouvel abonnement parent" })
  await dialog.getByLabel("Nom complet").fill("Parent Abonnement QA")
  await dialog.getByLabel("Téléphone", { exact: true }).fill(phone)
  await dialog.getByRole("button", { name: "Continuer", exact: true }).click()
  await dialog.getByRole("combobox").click()
  await page.getByRole("option", { name: /^Classe QA/ }).click()
  await dialog.getByRole("checkbox", { name: /Aya Recette|Recette Aya/ }).check()
  await dialog.getByRole("spinbutton").fill("2")
  await dialog.getByRole("button", { name: "Continuer", exact: true }).click()
  await expect(dialog.getByText(/Total: 2\s*000 FCFA/)).toBeVisible()
  const created = page.waitForResponse((r) => r.url().endsWith("/subscriptions/parents") && r.request().method() === "POST")
  await dialog.getByRole("button", { name: "Créer l'abonnement" }).click()
  const result = await created
  expect(result.status()).toBe(201)
  expect((await result.json()).subscription.total_amount_fcfa).toBe(2000)
  await expect(dialog.getByText("Accès parent créé", { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click()
  await page.reload()
  const row = page.getByRole("row", { name: /Parent Abonnement QA/ })
  await expect(row).toContainText(phone)
  await expect(row).toContainText("Actif")
  await row.getByRole("button", { name: "Actions pour Parent Abonnement QA" }).click()
  await page.getByRole("menuitem", { name: "Annuler l'abonnement", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation.getByRole("button", { name: "Annuler l'abonnement", exact: true })).toBeDisabled()
  await confirmation.getByLabel("Motif de l'annulation (obligatoire)").fill("Erreur de durée pour la recette QA")
  const cancelled = page.waitForResponse((r) => r.url().endsWith("/cancel") && r.request().method() === "PATCH")
  await confirmation.getByRole("button", { name: "Annuler l'abonnement", exact: true }).click()
  expect((await cancelled).status()).toBe(200)
  await page.reload()
  await expect(row).toContainText("Annulé")
  await row.getByRole("button", { name: "Renouveler l'accès", exact: true }).click()
  const renewal = page.getByRole("dialog", { name: "Renouveler l'abonnement" })
  await expect(renewal.getByText(/Montant total.*1\s*000 FCFA/)).toBeVisible()
  const renewed = page.waitForResponse((r) => r.url().endsWith("/renew") && r.request().method() === "POST")
  await renewal.getByRole("button", { name: "Renouveler", exact: true }).click()
  expect((await renewed).ok()).toBe(true)
  await page.reload()
  await expect(row).toContainText("Actif")
})

test("F31 : refuse les numéros invalides avant de choisir les enfants", async ({ page }) => {
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nom complet").fill("Parent Validation QA")
  for (const phone of ["225070", "0700000000000"]) {
    await dialog.getByLabel("Téléphone", { exact: true }).fill(phone)
    await expect(dialog.getByText("Format requis: 225 + 10 chiffres.")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Continuer", exact: true })).toBeDisabled()
  }
  await dialog.getByLabel("Téléphone", { exact: true }).fill("2250700008866")
  await expect(dialog.getByRole("button", { name: "Continuer", exact: true })).toBeEnabled()
})

test("F31 : ferme puis réinitialise le formulaire", async ({ page }) => {
  await page.getByLabel("Nom complet").fill("Parent À Effacer")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Nouvel abonnement", exact: true }).click()
  await page.getByRole("button", { name: "Ajouter un autre parent" }).click()
  await expect(page.getByLabel("Nom complet")).toHaveValue("")
})
