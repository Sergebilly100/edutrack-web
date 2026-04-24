import { expect, test } from "@playwright/test"

import { createDirectorApiAuth, findPayableMonth, loginAsDirectorUI, selectSalaryMonth } from "./helpers"

test.describe("Page salaires", () => {
  test.describe.configure({ mode: "serial" })

  let payableMonth = ""

  test.beforeAll(async ({ request }) => {
    const auth = await createDirectorApiAuth(request)
    payableMonth = await findPayableMonth(request, auth)
  })

  test.beforeEach(async ({ page }) => {
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

    const markPaidButtonTestId = await markPaidButton.getAttribute("data-testid")
    const teacherId = markPaidButtonTestId?.replace("salary-vacataire-mark-paid-", "")
    expect(teacherId).toBeTruthy()

    await markPaidButton.click()

    const remainingHoursText = await page
      .locator("p", { hasText: "Nombre d'heure restant à payer :" })
      .first()
      .textContent()
    const remainingHoursMatch = remainingHoursText?.match(/([0-9]+(?:[.,][0-9]+)?)h/)
    const remainingHours = remainingHoursMatch ? Number(remainingHoursMatch[1].replace(",", ".")) : 0
    const hoursToPay = Math.max(0.01, Math.min(1, Number.isFinite(remainingHours) ? remainingHours : 0.01))

    await page.getByLabel("Saisissez le nombre d'heure que vous souhaitez payer").fill(String(hoursToPay))
    await expect(page.getByRole("button", { name: "Confirmer le paiement" })).toBeEnabled()
    await page.getByRole("button", { name: "Confirmer le paiement" }).click()

    await expect(page.getByTestId(`salary-vacataire-status-${teacherId as string}`)).toContainText("Payé", {
      timeout: 15_000,
    })
  })

  test("l'export PDF est queué (bouton télécharger apparaît)", async ({ page }) => {
    await page.getByTestId("salaries-export-school-button").click()
    await page.getByRole("dialog", { name: "Exporter le bilan" }).getByRole("button", { name: "Générer" }).click()

    await expect(page.getByTestId("salaries-export-job-panel")).toBeVisible()
    await expect(page.getByTestId("salaries-export-download-link")).toBeVisible({ timeout: 45000 })
  })
})
