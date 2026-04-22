import { expect, test } from "@playwright/test"

import { createAdminApiAuth, createSchoolViaApi, loginAsAdminUI } from "./helpers"

test.describe("Console Super Admin - SMS & configuration école", () => {
  test.describe.configure({ mode: "serial" })

  test("la sidebar distingue correctement Dashboard et Écoles", async ({ page }) => {
    await loginAsAdminUI(page)
    await expect(page.getByRole("heading", { name: "Console EduTrack" })).toBeVisible()

    await page.getByRole("link", { name: "Écoles" }).click()
    await expect(page).toHaveURL(/\/admin\/schools/)
    await expect(page.getByRole("heading", { name: "Écoles" })).toBeVisible()

    await page.getByRole("link", { name: "Dashboard" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole("heading", { name: "Console EduTrack" })).toBeVisible()
  })

  test("les templates globaux SMS se chargent et peuvent être enregistrés", async ({ page }) => {
    await loginAsAdminUI(page)
    await page.goto("/admin/sms")

    await expect(page.getByRole("heading", { name: "SMS & Notifs" })).toBeVisible()
    await page.getByRole("tab", { name: "Gouvernance" }).click()

    await expect(page.getByRole("heading", { name: "Templates globaux SMS" })).toBeVisible()
    await expect(page.getByText("Configuration SMS plateforme")).toBeVisible()

    const templateTextArea = page.locator("textarea").first()
    await expect(templateTextArea).toBeVisible()
    const currentValue = await templateTextArea.inputValue()
    expect(currentValue.trim().length).toBeGreaterThanOrEqual(5)

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/sms/templates/") &&
        response.request().method() === "PUT"
    )

    await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
    const response = await responsePromise
    expect(response.ok()).toBeTruthy()
    await expect(page.getByText("Template global SMS enregistré")).toBeVisible()
  })

  test("le détail école gère SMS + paiement manuel + statistiques", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    const created = await createSchoolViaApi(request, auth, "pro")

    await loginAsAdminUI(page)
    await page.goto("/admin/schools")
    await page.getByPlaceholder("Rechercher une école").fill(created.schoolName)

    const row = page.locator("tbody tr").filter({ hasText: created.schoolName }).first()
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: "Config" }).click({ force: true })

    await expect(page).toHaveURL(/\/admin\/schools\/.+/)

    await page.getByRole("tab", { name: "SMS" }).click()
    await expect(page.getByText("Accès SMS côté école")).toBeVisible()
    await expect(page.getByText("Personnalisation templates école")).toBeVisible()

    await page.getByRole("button", { name: "Enregistrer ce paramètre" }).click()
    await expect(page.getByText("Paramètre SMS mis à jour")).toBeVisible()

    await page.getByRole("tab", { name: "Abonnement & Paiements" }).click()
    await expect(page.getByText("Enregistrer un paiement manuel")).toBeVisible()

    const reference = `E2E-PAY-${Date.now()}`
    await page.getByLabel("Montant (FCFA)").fill("15000")
    await page.getByLabel("Référence transaction").fill(reference)

    const paymentResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/v1\/admin\/schools\/.+\/payments$/.test(response.url()) &&
        response.request().method() === "POST"
    )

    await page.getByRole("button", { name: "+ Enregistrer le paiement" }).click()
    const paymentResponse = await paymentResponsePromise
    expect(paymentResponse.ok()).toBeTruthy()
    await expect(page.getByText("Paiement enregistré")).toBeVisible()
    await expect(page.getByText(reference)).toBeVisible()

    await page.getByRole("tab", { name: "Statistiques" }).click()
    await expect(page.getByText("Activité 30 jours (connexions)")).toBeVisible()
  })
})
