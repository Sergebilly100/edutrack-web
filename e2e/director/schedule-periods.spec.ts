import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const PERIOD_ID = "period-e2e-1"

const mockScheduleApis = async (
  page: import("@playwright/test").Page,
  hasPeriod = true
) => {
  const period = hasPeriod
    ? {
        id: PERIOD_ID,
        name: "Trimestre 1",
        valid_from: "2026-01-01",
        valid_to: "2026-06-30",
        is_active: true,
      }
    : null

  await page.route("**/api/v1/schedule/weekly*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-06-02",
        period,
        schedules: [],
        teachers: [],
        classes: [],
        rooms: [],
        time_slots: [],
      }),
    })
  })

  await page.route("**/api/v1/schedule/periods*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        periods: period ? [period] : [],
      }),
    })
  })

  await page.route("**/api/v1/schedule/active*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-06-02",
        period,
        schedules: [],
      }),
    })
  })

  await page.route("**/api/v1/teachers*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], total: 0, page: 1, limit: 200 }),
    })
  })

  await page.route("**/api/v1/schedule/next-week-coverage*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hasSchedule: false }),
    })
  })

  await page.route(`**/api/v1/schedule/periods/${PERIOD_ID}/duplicate`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        period: {
          id: "period-e2e-2",
          name: "Trimestre 2",
          valid_from: "2026-07-01",
          valid_to: "2026-12-31",
          is_active: true,
        },
        copied_schedules_count: 8,
      }),
    })
  })
}

test.describe("Périodes EDT - directeur", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
  })

  test("affiche l'alerte quand aucune période n'est active", async ({ page }) => {
    await mockScheduleApis(page, false)
    // Forcer le mode liste (défaut mobile) pour que l'alerte soit visible
    await page.addInitScript(() => localStorage.setItem("schedule-view-mode", "list"))
    await loginAsDirectorUI(page)

    await page.goto("/schedule")
    await expect(
      page.getByText(/aucune période active pour cette semaine/i)
    ).toBeVisible({ timeout: 10000 })
  })

  test("affiche le nom de la période active dans l'en-tête", async ({ page }) => {
    await mockScheduleApis(page, true)
    // La période est dans le CardDescription desktop (hidden md:block) - forcer viewport desktop
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.addInitScript(() => localStorage.setItem("schedule-view-mode", "list"))
    await loginAsDirectorUI(page)

    await page.goto("/schedule")
    await expect(page.getByText(/trimestre 1/i)).toBeVisible({ timeout: 10000 })
  })

  // Duplication is API-only in the current product, covered with persistence
  // by qa.school-workflows.routes.test.ts; no conditionally skipped UI promise.
})
