import { expect, test } from "@playwright/test"

import { createDirectorApiAuth, findPayableMonth, loginAsDirectorUI, selectSalaryMonth } from "./helpers"

test.describe("Page salaires", () => {
  let payableMonth = ""

  test.beforeEach(async ({ page, request }) => {
    const auth = await createDirectorApiAuth(request)
    payableMonth = await findPayableMonth(request, auth)

    await loginAsDirectorUI(page)
    await page.locator('a[href="/salaries"]:visible').first().click()
    await expect(page).toHaveURL(/\/salaries/)
    await selectSalaryMonth(page, payableMonth)
    await expect(page.getByTestId("salaries-page")).toBeVisible()
  })

  test("le tableau s'affiche avec les profs vacataires", async ({ page }) => {
    await expect(page.getByTestId("salaries-vacataire-section")).toBeVisible()
    await expect(page.getByTestId("salaries-vacataire-table")).toBeVisible()
    await expect(page.getByText("Vacataire").first()).toBeVisible()
  })

  test("le calcul des salaires crée les records", async ({ page }) => {
    await page.getByTestId("salaries-compute-button").click()
    await page.getByTestId("salaries-compute-confirm-button").click()

    await expect(page.locator("[data-testid^='salary-vacataire-row-']").first()).toBeVisible()
  })

  test("marquer un prof comme payé change le badge statut", async ({ page }) => {
    const markPaidButton = page.locator("[data-testid^='salary-vacataire-mark-paid-']").first()
    await expect(markPaidButton).toBeVisible()
    await markPaidButton.click()

    await page.getByRole("button", { name: "Confirmer le paiement" }).click()

    await expect(page.locator("[data-testid^='salary-vacataire-status-']", { hasText: "Payé" }).first()).toBeVisible()
  })

  test("l'export PDF est queué (bouton télécharger apparaît)", async ({ page }) => {
    await page.getByTestId("salaries-export-school-button").click()

    await expect(page.getByTestId("salaries-export-job-panel")).toBeVisible()
    await expect(page.getByTestId("salaries-export-download-link")).toBeVisible({ timeout: 45000 })
  })
})
