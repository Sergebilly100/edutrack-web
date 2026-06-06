import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const mockDashboardStats = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/v1/dashboard/stats*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        teacherAttendance: {
          globalRate: 0.85,
          partTime: { present: 5, expected: 6, rate: 0.83 },
          fullTime: { present: 10, expected: 11, rate: 0.91 },
        },
        studentAttendance: {
          rate: 0.92,
          present: 120,
          absent: 10,
          notMarked: 0,
          total: 130,
        },
        salaries: {
          monthlyTotal: 500000,
          toPayCurrentPeriod: 150000,
          totalPaid: 50000,
          remainingToPay: 100000,
          economy: {
            label: "mai 2026",
            plannedHours: 40,
            completedHours: 35,
            savedAmount: 25000,
          },
        },
        subscriptions: {
          isEnabled: false,
          collectedAmount: 0,
          activeSubscribers: 0,
          collectionRate: 0,
          expectedAmount: 0,
        },
      }),
    })
  })
}

const mockTodayAttendance = async (page: import("@playwright/test").Page) => {
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
}

test.describe("Dashboard directeur", () => {
  test("affiche les StatCards Présence professeurs et Présence élèves", async ({ page }) => {
    await mockDirectorAuth(page)
    await mockDashboardStats(page)
    await mockTodayAttendance(page)
    await page.route("**/api/v1/schedule/periods*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ periods: [{ id: "p1", name: "T1", valid_from: "2026-01-01", valid_to: "2026-12-31", is_active: true }] }),
      })
    })

    await loginAsDirectorUI(page)

    await expect(page.getByText("Présence professeurs")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Présence élèves")).toBeVisible()
    await expect(page.getByText("Salaire à payer ce mois")).toBeVisible()
  })

  test("les présences du jour sont listées", async ({ page }) => {
    await mockDirectorAuth(page)
    await mockDashboardStats(page)
    await mockTodayAttendance(page)
    await page.route("**/api/v1/schedule/periods*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ periods: [] }),
      })
    })

    await loginAsDirectorUI(page)

    await expect(page.getByTestId("dashboard-today-presence-list")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("dashboard-presence-row").first()).toBeVisible()
  })

  test("la WeekCoverageAlert apparaît si EDT manquant", async ({ page }) => {
    await mockDirectorAuth(page)
    await mockDashboardStats(page)
    await mockTodayAttendance(page)
    await page.route("**/api/v1/schedule/periods*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ periods: [] }),
      })
    })

    await loginAsDirectorUI(page)

    await expect(page.getByTestId("week-coverage-alert")).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: "Configurer l'EDT" })).toBeVisible()
  })

  test('navigation vers /teachers depuis "Voir tous"', async ({ page }) => {
    await mockDirectorAuth(page)
    await mockDashboardStats(page)
    await mockTodayAttendance(page)
    await page.route("**/api/v1/schedule/periods*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ periods: [] }),
      })
    })
    await page.route("**/api/v1/teachers*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 200, total: 0, totalPages: 0 },
        }),
      })
    })

    await loginAsDirectorUI(page)

    await page.getByTestId("dashboard-risk-see-all").click()
    await expect(page).toHaveURL(/\/teachers/)
  })
})
