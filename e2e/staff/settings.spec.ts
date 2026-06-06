import { expect, test } from "@playwright/test"

import { loginAsStaffUI } from "./helpers"

/**
 * Tests E2E du module settings côté staff.
 *
 * Les tests vérifient que les restrictions de permissions sont bien appliquées
 * dans l'UI pour un staff sans droits settings.
 *
 * Note : ces tests supposent que le compte staff E2E configuré via
 * E2E_STAFF_IDENTIFIER / E2E_STAFF_PASSWORD n'a PAS les permissions
 * settings.positions, settings.school, ni settings.sms_templates.
 * Si ce n'est pas le cas, les tests de restriction ne seront pas représentatifs.
 */

test.describe("Staff - accès aux paramètres", () => {
  test("le menu de navigation ne contient pas le lien 'Paramètres' pour un staff sans permission", async ({
    page,
  }) => {
    await loginAsStaffUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    // Un staff sans permission settings ne voit pas le lien dans le menu
    await expect(page.getByRole("link", { name: "Paramètres" })).toHaveCount(0)
  })

  test("un staff sans permission est redirigé s'il tente d'accéder directement à /settings", async ({
    page,
  }) => {
    await loginAsStaffUI(page)
    // Simuler une navigation directe vers /settings via l'API history
    await page.evaluate(() => {
      window.history.pushState({}, "", "/settings")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    // L'app doit rediriger vers une route autorisée, pas rester sur /settings
    await expect(page).not.toHaveURL(/\/settings$/)
    await expect(page).toHaveURL(/\/dashboard|\/teachers|\/students|\/schedule/)
  })

  test("un staff sans permission settings.positions ne voit pas le bouton 'Nouveau poste' si la page settings est accessible", async ({
    page,
  }) => {
    await loginAsStaffUI(page)
    // Ce test est pertinent si le staff a accès à /settings mais sans settings.positions
    // Si la redirection a lieu, le test est trivial - on vérifie l'absence du bouton
    await page.goto("/settings")
    // Attendre que la page se stabilise (redirection ou affichage)
    await page.waitForTimeout(500)

    const currentUrl = page.url()
    if (currentUrl.includes("/settings")) {
      // Si la page est accessible : le bouton "Nouveau poste" ne doit pas être visible
      await expect(page.getByRole("button", { name: "Nouveau poste" })).toHaveCount(0)
    } else {
      // Si redirigé : le test est satisfait (l'accès a bien été refusé)
      await expect(page).not.toHaveURL(/\/settings/)
    }
  })

  test("un staff sans aucune permission settings voit le message de restriction sur /settings si accessible", async ({
    page,
  }) => {
    await loginAsStaffUI(page)
    await page.goto("/settings")
    await page.waitForTimeout(500)

    const currentUrl = page.url()
    if (currentUrl.includes("/settings")) {
      // Le ContextualHelp de restriction doit être affiché
      await expect(page.getByText("Paramètres non disponibles")).toBeVisible()
    } else {
      // Redirigé : accès correctement refusé
      await expect(page).not.toHaveURL(/\/settings/)
    }
  })
})
