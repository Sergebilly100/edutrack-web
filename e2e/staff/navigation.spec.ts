import { expect, test } from "@playwright/test"

import { loginAsStaffUI } from "./helpers"

test.describe("Staff - navigation et permissions", () => {
  test("le staff voit son dashboard et n'a pas les menus directeur sensibles", async ({ page }) => {
    await loginAsStaffUI(page)
    await expect(page).toHaveURL(/\/dashboard/)

    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await expect(page.getByRole("link", { name: "Tableau de bord" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Salaires" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Paramètres" })).toHaveCount(0)
  })

  test("un staff non autorisé est redirigé s'il tente /settings", async ({ page }) => {
    await loginAsStaffUI(page)
    await page.evaluate(() => {
      window.history.pushState({}, "", "/settings")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    await expect(page).not.toHaveURL(/\/settings$/)
    await expect(page).toHaveURL(/\/dashboard|\/teachers|\/students|\/schedule/)
  })
})
