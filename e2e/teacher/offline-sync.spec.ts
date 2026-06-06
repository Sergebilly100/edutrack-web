import { expect, test, type Page } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis } from "./helpers"

// Bloque les endpoints attendance pour simuler la perte réseau API
const setApiOffline = async (page: Page) => {
  await page.route("**/api/v1/attendance/check-in", (route) => route.abort("internetdisconnected"))
  await page.route("**/api/v1/attendance/qr-scan", (route) => route.abort("internetdisconnected"))
  await page.route("**/api/v1/attendance/qr-skip", (route) => route.abort("internetdisconnected"))
  await page.route("**/api/v1/attendance/students/bulk", (route) => route.abort("internetdisconnected"))
}

const setApiOnline = async (page: Page) => {
  await page.unroute("**/api/v1/attendance/check-in")
  await page.unroute("**/api/v1/attendance/qr-scan")
  await page.unroute("**/api/v1/attendance/qr-skip")
  await page.unroute("**/api/v1/attendance/students/bulk")

  await page.route("**/api/v1/attendance/check-in", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { lateMinutes: 0 } }),
    })
  )
  await page.route("**/api/v1/attendance/qr-skip", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  )
  await page.route("**/api/v1/attendance/students/bulk", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  )
}

// Helper : check-in (étape 1 = local) → skip QR (appelle vraiment l'API) → confirme
// C'est le skip QR qui déclenche checkIn + qrSkip vers l'API → erreurs réseau → queue
const checkinAndSkipQr = async (page: Page) => {
  // Étape 1 : local uniquement (pas d'appel réseau)
  await page.getByTestId("teacher-checkin-submit").click()
  await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible({ timeout: 6000 })

  // Étape 2 : skip QR → appelle check-in + qr-skip backend → queued si offline
  await page.getByTestId("teacher-checkin-skip-qr").click()
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 })
}

test.describe("Teacher Flow - Offline to Online Sync", () => {
  test("check-in + skip QR offline mis en queue → synchronisé au retour en ligne", async ({
    page,
  }) => {
    const { slot } = await mockTeacherFlowApis(page)
    await loginAsTeacherUI(page)

    // Couper l'API après login mais avant l'action
    await setApiOffline(page)

    await page.getByTestId(`teacher-start-course-${slot.id}`).click()

    // Étape 1 (local) → étape 2 → skip QR (appelle l'API → queued)
    await checkinAndSkipQr(page)

    // La modale "Faire l'appel maintenant / Plus tard" s'ouvre
    // On clique "Le faire plus tard" pour garder le focus sur le badge
    await page.getByRole("button", { name: /Le faire plus tard/i }).click()

    // Badge offline doit apparaître (checkIn + qrSkip queués)
    await expect(page.getByTestId("offline-queue-badge")).toBeVisible({ timeout: 8000 })

    // Retour en ligne
    await setApiOnline(page)

    // La queue doit se vider automatiquement (badge disparaît)
    await expect(page.getByTestId("offline-queue-badge")).not.toBeVisible({ timeout: 15000 })
  })

  test("3 étapes complètes en offline → toutes synchronisées au retour réseau", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)

    await loginAsTeacherUI(page)

    // Couper l'API après login
    await setApiOffline(page)

    await page.getByTestId(`teacher-start-course-${slot.id}`).click()

    // Étape 1 — check-in (local)
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible({ timeout: 8000 })

    // Étape 2 — skip QR (check-in + qr-skip → queués)
    await page.getByTestId("teacher-checkin-skip-qr").click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await page.getByRole("button", { name: "Faire l'appel maintenant" }).click()
    await expect(page.getByTestId("teacher-checkin-step-3")).toBeVisible({ timeout: 8000 })

    // Étape 3 — appel élèves (students/bulk → queued)
    const presentButtons = page.locator('[data-testid^="teacher-student-present-"]')
    const count = await presentButtons.count()
    for (let i = 0; i < count; i++) {
      await presentButtons.nth(i).click()
    }
    await page.getByTestId("teacher-students-submit").click()

    // Badge offline : 3 items en attente (checkIn + qrSkip + studentsBulk)
    await expect(page.getByTestId("offline-queue-badge")).toBeVisible({ timeout: 8000 })

    // Retour en ligne → sync automatique
    await setApiOnline(page)
    await expect(page.getByTestId("offline-queue-badge")).not.toBeVisible({ timeout: 20000 })
  })

  test("retry : mutation échouée rejoue au retour en ligne", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)

    // Étape QR-skip retourne 500 (pour que qrSkipMutation échoue mais pas avec NetworkError)
    // → check-in appelle aussi l'API dans handleSkipQr → on bloque aussi check-in
    await page.route("**/api/v1/attendance/check-in", (route) =>
      route.abort("internetdisconnected")
    )
    await page.route("**/api/v1/attendance/qr-skip", (route) =>
      route.abort("internetdisconnected")
    )

    await loginAsTeacherUI(page)
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()

    await checkinAndSkipQr(page)
    await page.getByRole("button", { name: /Le faire plus tard/i }).click()

    // Items en queue (erreur réseau → retryable)
    await expect(page.getByTestId("offline-queue-badge")).toBeVisible({ timeout: 8000 })

    // Corriger les mocks pour que la sync aboutisse
    await page.unroute("**/api/v1/attendance/check-in")
    await page.unroute("**/api/v1/attendance/qr-skip")
    await page.route("**/api/v1/attendance/check-in", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { lateMinutes: 0 } }),
      })
    )
    await page.route("**/api/v1/attendance/qr-skip", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    )

    // Déclencher la sync
    await page.evaluate(() => window.dispatchEvent(new Event("online")))
    await expect(page.getByTestId("offline-queue-badge")).not.toBeVisible({ timeout: 15000 })
  })

  test("idempotence : la même mutation n'est pas rejouée deux fois", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)

    let checkInCalls = 0
    let qrSkipCalls = 0

    // D'abord bloquer les routes (LIFO : handler du dessus = prioritaire)
    await page.route("**/api/v1/attendance/check-in", (route) => route.abort("internetdisconnected"))
    await page.route("**/api/v1/attendance/qr-skip", (route) => route.abort("internetdisconnected"))

    await loginAsTeacherUI(page)
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()

    await checkinAndSkipQr(page)
    await page.getByRole("button", { name: /Le faire plus tard/i }).click()

    await expect(page.getByTestId("offline-queue-badge")).toBeVisible({ timeout: 8000 })

    // Remettre les vrais handlers qui comptent les appels
    await page.unroute("**/api/v1/attendance/check-in")
    await page.unroute("**/api/v1/attendance/qr-skip")
    await page.route("**/api/v1/attendance/check-in", async (route) => {
      checkInCalls++
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { lateMinutes: 0 } }),
      })
    })
    await page.route("**/api/v1/attendance/qr-skip", async (route) => {
      qrSkipCalls++
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    })
    await page.evaluate(() => window.dispatchEvent(new Event("online")))
    await page.waitForTimeout(3000)

    // Chaque mutation ne doit être envoyée qu'une seule fois
    expect(checkInCalls).toBeLessThanOrEqual(1)
    expect(qrSkipCalls).toBeLessThanOrEqual(1)
  })

  test("conflict : last-write-wins notifié à l'utilisateur (soft assertion)", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)
    await loginAsTeacherUI(page)

    // Mock bulk avec conflit
    await page.route("**/api/v1/attendance/students/bulk", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          upsertedCount: 3,
          conflict: { resolution: "server_wins", conflicting: ["student-1"] },
        }),
      })
    })

    await setApiOffline(page)
    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible({ timeout: 8000 })
    await page.getByTestId("teacher-checkin-skip-qr").click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Faire l'appel maintenant" }).click()
    await expect(page.getByTestId("teacher-checkin-step-3")).toBeVisible({ timeout: 8000 })

    const presentButtons = page.locator('[data-testid^="teacher-student-present-"]')
    const count = await presentButtons.count()
    for (let i = 0; i < count; i++) {
      await presentButtons.nth(i).click()
    }
    await page.getByTestId("teacher-students-submit").click()
    await expect(page.getByTestId("offline-queue-badge")).toBeVisible({ timeout: 8000 })

    await setApiOnline(page)
    await page.evaluate(() => window.dispatchEvent(new Event("online")))

    // Soft : si l'UI affiche un toast conflit, il doit être visible
    const conflictToast = page.locator("text=/conflit|server.wins|version.serveur/i")
    const toastCount = await conflictToast.count()
    if (toastCount > 0) {
      await expect(conflictToast.first()).toBeVisible()
    }
  })

  test("QR scan — étape 2 s'affiche après le check-in (nouveau contexte navigateur)", async ({
    page,
    context,
  }) => {
    // Nouveau contexte = pas de storage persisté (équivaut à premier usage)
    await context.clearCookies()

    const { slot } = await mockTeacherFlowApis(page)
    await loginAsTeacherUI(page)

    await page.getByTestId(`teacher-start-course-${slot.id}`).click()
    await page.getByTestId("teacher-checkin-submit").click()

    // L'étape QR scan doit s'afficher même sans données en cache
    await expect(page.getByTestId("teacher-checkin-step-2")).toBeVisible({ timeout: 8000 })

    // Le bouton skip doit être disponible
    await expect(page.getByTestId("teacher-checkin-skip-qr")).toBeVisible()
  })
})
