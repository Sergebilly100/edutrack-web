import { expect, test } from "@playwright/test"

import { loginAsDirectorUI } from "./helpers"

test.describe("Dashboard directeur", () => {
  test("affiche les 4 StatCards sans erreur", async ({ page }) => {
    await loginAsDirectorUI(page)
    const statCards = page.getByTestId("dashboard-statcards").locator("article")

    await expect(statCards).toHaveCount(4)
    await expect(page.getByText("Profs actifs")).toBeVisible()
    await expect(page.getByText("Élèves actifs")).toBeVisible()
    await expect(page.getByText("Présence profs aujourd'hui")).toBeVisible()
    await expect(page.getByText("Salaires à payer")).toBeVisible()
  })

  test("les présences du jour sont listées", async ({ page }) => {
    const mockedTodayAttendance = {
      date: "2026-04-25",
      presentCount: 1,
      absentCount: 0,
      unmarkedCount: 0,
      courses: [
        {
          id: "course-e2e-1",
          teacherName: "Mme Konate",
          subject: "Mathématiques",
          className: "6A",
          roomName: "Salle 1",
          slotLabel: "08:00-09:00",
          startTime: "08:00",
          endTime: "09:00",
          status: "present",
          lateMinutes: 0,
          roomMismatch: false,
          roomScannedName: "Salle 1",
          checkedInAt: "2026-04-25T08:01:00.000Z",
        },
      ],
    }

    await page.route("**/api/v1/attendance/today*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockedTodayAttendance),
      })
    })
    await page.route("**/api/v1/attendance/active*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockedTodayAttendance),
      })
    })

    await loginAsDirectorUI(page)
    await expect(page.getByTestId("dashboard-today-presence-list")).toBeVisible()
    await expect(page.getByTestId("dashboard-presence-row").first()).toBeVisible()
  })

  test("la WeekCoverageAlert apparaît si EDT manquant", async ({ page }) => {
    await page.route("**/api/v1/schedule/periods*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ periods: [] }),
      })
    })

    await loginAsDirectorUI(page)

    await expect(page.getByTestId("week-coverage-alert")).toBeVisible()
    await expect(page.getByRole("button", { name: "Configurer l'EDT" })).toBeVisible()
  })

  test('navigation vers /teachers depuis "Voir tous"', async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByTestId("dashboard-risk-see-all").click()
    await expect(page).toHaveURL(/\/teachers/)
    await expect(page.getByRole("heading", { name: /Professeurs/i })).toBeVisible()
  })
})
