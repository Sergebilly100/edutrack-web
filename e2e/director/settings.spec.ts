import { expect, test } from "@playwright/test"

import { loginAsDirectorUI } from "./helpers"

test.describe("Directeur — module paramètres", () => {
  test("affiche le titre 'Paramètres école' après navigation via le menu", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Paramètres" }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByText("Paramètres école")).toBeVisible()
  })

  test("affiche la section 'Informations école'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Informations école")).toBeVisible()
  })

  test("affiche la section 'Postes administratifs'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Postes administratifs")).toBeVisible()
  })

  test("le directeur voit le bouton 'Nouveau poste'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByRole("button", { name: "Nouveau poste" })).toBeVisible()
  })

  test("ouvre le modal de création de poste en cliquant sur 'Nouveau poste'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    // Le titre du dialog est "Nouveau poste"
    await expect(page.getByRole("dialog").getByText("Nouveau poste")).toBeVisible()
    // Le champ nom du poste est présent (placeholder "Ex: Censeur, Surveillant général…")
    await expect(page.getByPlaceholder(/Censeur/i)).toBeVisible()
  })

  test("ferme le modal de création avec le bouton Annuler", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Annuler" }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("empêche la soumission du formulaire si le nom du poste est trop court", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Saisir un nom trop court (1 caractère) pour déclencher la validation Zod
    await page.getByPlaceholder(/Censeur/i).fill("A")
    await page.getByRole("button", { name: "Créer le poste" }).click()

    // Le message d'erreur Zod doit apparaître
    await expect(page.getByText(/au moins 2 caractères/i)).toBeVisible()
    // Le dialog doit rester ouvert
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("le bouton 'Créer le poste' est actif quand le nom est valide", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Saisir un nom valide (min 2 chars)
    await page.getByPlaceholder(/Censeur/i).fill("Censeur")
    const submitButton = page.getByRole("button", { name: "Créer le poste" })
    await expect(submitButton).not.toBeDisabled()
  })

  test("affiche la section 'Template SMS absence élève' pour le directeur", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Template SMS absence élève")).toBeVisible()
  })

  test("affiche les badges de statut École et SMS dans le centre de configuration", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    // Les badges affichent "École: <état>" et "SMS: <état>"
    await expect(page.getByText(/^École:/).first()).toBeVisible()
    await expect(page.getByText(/^SMS:/).first()).toBeVisible()
  })

  test("affiche la section 'Utilisateurs administratifs'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Utilisateurs administratifs")).toBeVisible()
  })

  test("la page /settings utilise l'animation fade-in du conteneur principal", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    // Le conteneur principal a la classe animate-fade-in (div wrappant OfflineIndicator + contenu)
    const mainContainer = page.locator(".animate-fade-in").first()
    await expect(mainContainer).toBeAttached()
  })
})
