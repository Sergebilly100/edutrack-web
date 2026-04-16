import { expect, test } from "@playwright/test"

import { loginAsDirectorUI } from "./helpers"

const openTeacherDetail = async (
  page: import("@playwright/test").Page,
  options?: { activeOnly?: boolean }
) => {
  const cards = page.getByTestId("teacher-mobile-card")
  await expect(cards.first()).toBeVisible()

  const targetCard = options?.activeOnly
    ? cards.filter({ hasText: "Actif" }).first()
    : cards.first()

  await targetCard.click()
  await expect(page).toHaveURL(/\/teachers\/.+/)
  await expect(page.getByText("Professeur introuvable.")).toHaveCount(0)
}

test.describe("Gestion profs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Professeurs" }).click()
    await expect(page).toHaveURL(/\/teachers/)
    await expect(page.getByRole("heading", { name: /Professeurs/i })).toBeVisible()
  })

  test("la liste des profs se charge", async ({ page }) => {
    await expect(page.getByTestId("teachers-list-table")).toBeVisible()
    await expect(page.getByTestId("teacher-mobile-card").first()).toBeVisible()
  })

  test("la recherche filtre les résultats", async ({ page }) => {
    const cards = page.getByTestId("teacher-mobile-card")
    await expect(cards.first()).toBeVisible()

    const firstTeacherName = (await cards.first().locator("p").first().textContent())?.trim() ?? ""
    expect(firstTeacherName.length).toBeGreaterThan(0)

    await page.getByTestId("datatable-search-input").fill(firstTeacherName)

    await expect(page.getByTestId("teacher-mobile-card")).toHaveCount(1)
    await expect(page.getByText(firstTeacherName).first()).toBeVisible()
  })

  test("navigation vers le détail prof", async ({ page }) => {
    await openTeacherDetail(page)
    await expect(page.getByRole("tab", { name: "Profil" }).first()).toBeVisible()
  })

  test("le blocage d'un prof requiert une raison", async ({ page }) => {
    await openTeacherDetail(page, { activeOnly: true })
    await expect(page.getByRole("tab", { name: "Profil" }).first()).toBeVisible()

    const blockButton = page.getByRole("button", { name: "Bloquer" }).first()
    await blockButton.scrollIntoViewIfNeeded()
    await blockButton.click()
    await page.getByRole("button", { name: "Confirmer" }).click()

    const confirmButton = page.getByTestId("teacher-block-confirm-button")
    await expect(confirmButton).toBeDisabled()

    await page.getByTestId("teacher-block-reason-input").fill("Test E2E blocage")
    await expect(confirmButton).toBeEnabled()
  })

  test("upload d'un document apparaît dans la liste", async ({ page }) => {
    await openTeacherDetail(page)
    await expect(page.getByRole("tab", { name: "Documents" }).first()).toBeVisible()

    await page.getByRole("tab", { name: "Documents" }).first().click()
    await expect(page.getByTestId("document-upload-dropzone")).toBeVisible()

    const fileName = `e2e-director-${Date.now()}.pdf`

    await page.getByTestId("document-upload-input").setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% E2E test file\n"),
    })

    await expect(page.getByText("Téléversé")).toBeVisible()
    await expect(page.getByTestId("document-list-table")).toContainText(fileName)
  })
})
