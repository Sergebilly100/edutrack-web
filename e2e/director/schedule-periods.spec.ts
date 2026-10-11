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
    await expect(page.getByRole("alert")).toContainText(
      "Aucune période active. Importez l'emploi du temps",
      { timeout: 10000 }
    )
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

test("filtre Niveau utilisable au clavier sur petits écrans", async ({ page }) => {
  await mockDirectorAuth(page)
  await page.route("**/api/v1/auth/login/teacher", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      accessToken: "director-e2e-token", tokenType: "Bearer", expiresIn: "15m",
      user: { id: "director-e2e-user", role: "director", name: "Directeur E2E", phone: null, email: null, profilePhotoUrl: null },
    }) })
  })
  await mockScheduleApis(page)
  await page.route("**/api/v1/schedule/weekly*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      date: "2026-06-02",
      period: { id: PERIOD_ID, name: "Trimestre 1", valid_from: "2026-01-01", valid_to: "2026-12-31", is_active: true },
      schedules: [], teachers: [], rooms: [], time_slots: [],
      classes: [{ id: "class-6", name: "6A", levelId: "level-6", levelName: "6ème" }],
    }) })
  })
  await page.addInitScript(() => localStorage.setItem("schedule-view-mode", "list"))
  await loginAsDirectorUI(page)

  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 740 })
    await page.goto("/schedule")
    const level = page.getByRole("combobox", { name: "Filtrer par niveau" })
    await expect(level).toBeVisible()
    for (const name of ["Filtrer par niveau", "Filtrer par professeur", "Filtrer par classe"]) {
      const box = await page.getByRole("combobox", { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.height).toBeGreaterThanOrEqual(48)
    }
    await level.focus()
    await page.keyboard.press("Enter")
    const levelOption = page.getByRole("option", { name: "6ème" })
    await expect(levelOption).toBeVisible()
    await levelOption.focus()
    await page.keyboard.press("Enter")
    await expect(level).toContainText("6ème")
    await expect(page.getByRole("button", { name: /effacer le filtre niveau/i })).toBeVisible()
    await page.getByRole("button", { name: /effacer le filtre niveau/i }).click()
    await expect(level).toContainText("Tous les niveaux")
  }
})
