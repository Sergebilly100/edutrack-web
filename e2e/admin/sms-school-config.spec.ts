import { expect, test } from "@playwright/test"

import { createAdminApiAuth, createSchoolViaApi, loginAsAdminUI } from "./helpers"

test.describe("Console Super Admin - SMS & configuration école", () => {
  test.describe.configure({ mode: "serial" })

  test("la sidebar distingue correctement Dashboard et Écoles", async ({ page }) => {
    await loginAsAdminUI(page)
    await expect(page.getByRole("heading", { name: "Console IvoirEdu" })).toBeVisible()

    await page.getByRole("link", { name: "Écoles" }).click()
    await expect(page).toHaveURL(/\/admin\/schools/)
    await expect(page.getByRole("heading", { name: "Écoles" })).toBeVisible()

    await page.getByRole("link", { name: "Dashboard" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole("heading", { name: "Console IvoirEdu" })).toBeVisible()
  })

  test("les templates globaux SMS se chargent et peuvent être enregistrés", async ({ page }) => {
    await loginAsAdminUI(page)
    await page.getByRole("button", { name: "Plateforme", exact: true }).click()
    await page.getByRole("link", { name: "Pilotage SMS" }).click()

    await expect(page.getByRole("heading", { name: "Pilotage SMS" })).toBeVisible()
    await page.getByRole("tab", { name: "Gouvernance" }).click()

    await expect(page.getByText("Templates globaux SMS", { exact: true })).toBeVisible()
    await expect(page.getByText("Configuration SMS plateforme")).toBeVisible()

    const templateTextArea = page.locator("textarea").first()
    await expect(templateTextArea).toBeVisible()
    const currentValue = await templateTextArea.inputValue()
    if (currentValue.trim().length < 5) {
      await templateTextArea.fill("EduTrack: {studentFirstName} absent(e) le {date}. Contact: {schoolPhone}.")
    }

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/sms/templates/") &&
        response.request().method() === "PUT"
    )

    await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
    const response = await responsePromise
    expect(response.ok()).toBeTruthy()
    await expect(page.getByText("Template global SMS enregistré", { exact: true }).first()).toBeVisible()
  })

  test("le détail école gère SMS + paiement manuel + statistiques", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    const created = await createSchoolViaApi(request, auth, "pro")

    await loginAsAdminUI(page)
    await page.getByRole("link", { name: "Écoles" }).click()
    await page.getByPlaceholder("Rechercher une école").fill(created.schoolName)

    const row = page.locator("tbody tr").filter({ hasText: created.schoolName }).first()
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: "Config" }).click()

    await expect(page).toHaveURL(/\/admin\/schools\/.+/)

    await page.getByRole("tab", { name: "SMS" }).click()
    await expect(page.getByRole("heading", { name: "Paramètres SMS" })).toBeVisible()
    await page.getByLabel("Gratuit", { exact: true }).check()
    await page.getByRole("button", { name: "Sauvegarder le mode" }).click()
    await expect(page.getByText("Configuration SMS mise à jour", { exact: true }).first()).toBeVisible()

    await page.getByRole("tab", { name: "Facturation", exact: true }).click()
    await expect(page.getByText("Enregistrer un paiement", { exact: true })).toBeVisible()
    const paymentForm = page.getByText("Enregistrer un paiement", { exact: true }).locator("../..")
    const reference = `E2E-PAY-${Date.now()}`
    await paymentForm.getByRole("spinbutton").fill("15000")
    await paymentForm.getByPlaceholder("Optionnel").fill(reference)
    await paymentForm.getByRole("combobox").nth(1).click()
    await page.getByRole("option").first().click()
    await paymentForm.getByRole("combobox").nth(2).click()
    await page.getByRole("option").first().click()

    const paymentResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/v1\/admin\/schools\/.+\/payments$/.test(response.url()) &&
        response.request().method() === "POST"
    )

    await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click()
    const paymentResponse = await paymentResponsePromise
    expect(paymentResponse.ok()).toBeTruthy()
    await expect(page.getByText("Paiement enregistré", { exact: true }).first()).toBeVisible()
    await expect(page.getByText(reference)).toBeVisible()

    await page.getByRole("tab", { name: "Statistiques" }).click()
    await expect(page.getByText("Activité 30 jours (connexions)")).toBeVisible()
  })
})
