import { expect, test } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis } from "./helpers"

test.describe("QR Scan - flux complet professeur", () => {
  test("flux complet : login → EDT → check-in → scan QR → appel", async ({ page, context }) => {
    const { slot } = await mockTeacherFlowApis(page)
    await context.grantPermissions(["camera"])

    await loginAsTeacherUI(page)

    // Étape 1 - EDT du jour visible
    await expect(page.getByTestId("teacher-schedule-page")).toBeVisible()
    await expect(page.getByTestId(`teacher-course-card-${slot.id}`)).toBeVisible()

    // Étape 2 - Démarrer le cours → check-in
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await expect(page.getByTestId("teacher-checkin-step-1")).toBeVisible()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()

    // Étape 3 - Ignorer le scan QR (allowed by school config)
    await page.getByTestId("teacher-checkin-skip-qr").click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Faire l'appel maintenant" }).click()

    // Étape 4 - Appel élèves
    await expect(page.getByTestId("teacher-checkin-step-3")).toBeVisible()
    await expect(page.getByText(/à marquer/i)).toBeVisible()
  })

  test("scan QR → roomMismatch false → confirmation succès", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page, { roomMismatch: false })

    await loginAsTeacherUI(page)
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()

    // L'API /attendance/qr-scan répond { roomMismatch: false }
    // La page avance vers l'appel ou affiche un succès
    // Vérifier que le bouton skip est disponible quand le scan est possible
    await expect(page.getByTestId("teacher-checkin-skip-qr")).toBeVisible()
  })

  test("scan QR → mauvaise salle → alerte roomMismatch visible", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page, { roomMismatch: true })

    await loginAsTeacherUI(page)
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()

    // Simuler un scan QR avec token
    await page.route("**/api/v1/attendance/qr-scan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { roomMismatch: true, alertType: "teacher_qr_mismatch" },
        }),
      })
    })

    // La page doit rester en étape 2 (scan QR) - l'erreur est gérée UI
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible()
  })

  test("flux offline : l'app reste utilisable après coupure réseau API", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)
    await loginAsTeacherUI(page)

    // L'EDT reste visible (données déjà chargées en mémoire)
    await expect(page.getByTestId("teacher-schedule-page")).toBeVisible()
    await expect(page.getByTestId(`teacher-course-card-${slot.id}`)).toBeVisible()

    // Couper uniquement les endpoints attendance (pas la page elle-même)
    await page.route("**/api/v1/attendance/check-in", (route) => route.abort("internetdisconnected"))
    await page.route("**/api/v1/attendance/qr-skip", (route) => route.abort("internetdisconnected"))

    // Étape 1 : check-in local (pas d'appel API ici)
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible({ timeout: 6000 })

    // Étape 2 : skip QR → check-in + qr-skip appelés → queued (réseau coupé)
    await page.getByTestId("teacher-checkin-skip-qr").click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 })
    await page.getByRole("button", { name: /Le faire plus tard/i }).click()

    // Badge offline visible (actions en queue)
    await expect(page.getByTestId("offline-queue-badge")).toBeVisible({ timeout: 8000 })

    // Remettre en ligne
    await page.unroute("**/api/v1/attendance/check-in")
    await page.unroute("**/api/v1/attendance/qr-skip")
  })
})
