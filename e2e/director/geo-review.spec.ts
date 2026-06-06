import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

// Ces tests couvrent l'onglet "Présences suspectes" (GPS) de la page /validations.
// L'ancienne implémentation ciblait /attendance/suspicious qui n'existe pas dans l'app.

const GPS_ENTRY = {
  attendance_id: "att-gps-e2e-1",
  teacher_id: "t-gps-1",
  teacher_name: "M. Koné GPS",
  course_name: "Maths",
  class_name: "3A",
  date: "2026-05-20",
  checked_in_at: "2026-05-20T08:02:00",
  checked_out_at: null,
  geo_status: "suspicious",
  checkin_distance: 250,
  actual_minutes: null,
  schedule_duration_minutes: 60,
  validation_reason: null,
  hourly_rate: 5000,
  kind: "gps_suspicious",
  slot_label: "8h-9h",
  room_name: "Salle GPS-A",
}

const mockValidationsApis = async (
  page: import("@playwright/test").Page,
  gpsEntries: unknown[] = [GPS_ENTRY]
) => {
  await page.route("**/api/v1/validations/pending*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        gps_suspicious: gpsEntries,
        short_hours: [],
      }),
    })
  })
  await page.route("**/api/v1/validations/missing-end-scans*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })
}

test.describe("Revue GPS — page validations (onglet Présences suspectes)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockDirectorAuth(page)
  })

  test("affiche les présences GPS suspectes dans l'onglet dédié", async ({ page }) => {
    await mockValidationsApis(page)
    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(
      page.getByRole("heading", { name: /validation des horaires/i })
    ).toBeVisible({ timeout: 10000 })

    await expect(page.getByRole("tab", { name: /présences suspectes/i })).toBeVisible()
    await page.getByRole("tab", { name: /présences suspectes/i }).click()

    // Les colonnes Créneau et Salle s'affichent
    await expect(page.getByRole("columnheader", { name: /créneau/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /salle/i })).toBeVisible()

    // Les données mockées sont visibles (filter visible: mobile cards sont hidden)
    await expect(page.getByText("M. Koné GPS").filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText("8h-9h").filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText("Salle GPS-A").filter({ visible: true }).first()).toBeVisible()
  })

  test("cliquer Valider ouvre une modale de confirmation GPS", async ({ page }) => {
    await mockValidationsApis(page)
    await page.route("**/api/v1/validations/att-gps-e2e-1/approve*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    })

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(
      page.getByRole("heading", { name: /validation des horaires/i })
    ).toBeVisible({ timeout: 10000 })
    await page.getByRole("tab", { name: /présences suspectes/i }).click()

    await expect(page.getByRole("button", { name: /valider/i }).first()).toBeVisible({ timeout: 10000 })
    await page.getByRole("button", { name: /valider/i }).first().click()

    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText(/valider la présence de M\. Koné GPS/i)).toBeVisible()
  })

  test("marquer une présence GPS comme absente — la modale de confirmation s'ouvre", async ({ page }) => {
    await mockValidationsApis(page)
    await page.route("**/api/v1/validations/att-gps-e2e-1/reject*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    })

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(
      page.getByRole("heading", { name: /validation des horaires/i })
    ).toBeVisible({ timeout: 10000 })
    await page.getByRole("tab", { name: /présences suspectes/i }).click()

    // Le bouton de rejet s'appelle "Marquer absent" dans l'UI
    const rejectButton = page.getByRole("button", { name: /marquer absent/i }).first()
    await expect(rejectButton).toBeVisible({ timeout: 10000 })
    await rejectButton.click()

    // Une modale de confirmation s'affiche
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText(/refuser la présence/i)).toBeVisible()
  })

  test("les 3 onglets sont visibles sur la page validations", async ({ page }) => {
    await mockValidationsApis(page)
    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(
      page.getByRole("heading", { name: /validation des horaires/i })
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("tab", { name: /présences suspectes/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /heures à valider/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /scan de fin/i })).toBeVisible()
  })

  test("état vide quand aucune présence suspecte", async ({ page }) => {
    await mockValidationsApis(page, [])

    await loginAsDirectorUI(page)
    await page.goto("/validations")

    await expect(
      page.getByRole("heading", { name: /validation des horaires/i })
    ).toBeVisible({ timeout: 10000 })

    // Aucune ligne de présence GPS — le tableau est vide ou un message "aucun" s'affiche
    await expect(page.getByRole("button", { name: /valider/i })).toHaveCount(0)
  })
})
