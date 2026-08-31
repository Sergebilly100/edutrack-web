import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const mockDashboardStats = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/v1/dashboard/stats*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        teacherAttendance: {
          globalRate: 85,
          partTime: { present: 5, expected: 6, rate: 83 },
          fullTime: { present: 10, expected: 11, rate: 91 },
        },
        studentAttendance: {
          rate: 92,
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
  await page.route("**/api/v1/dashboard/pilotage*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        population: { activeStudents: 130, activeTeachers: 16, activeClasses: 8 },
        academic: [{ levelId: "level-6e", levelName: "6e", classCount: 2, expectedSubjects: 12, completedSubjects: 9, completionRate: 75, studentsWithAverage: 46, averageScore: 11.8, performingStudents: 31, attentionStudents: 9, criticalStudents: 6 }],
        risks: { studentAbsences: 3, studentGrades: 2, studentPayments: 4, teacherAbsences: 1 },
      }),
    })
  })
  await page.route("**/api/v1/finance/financial-summary*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        school: { total_expected_to_date: "1200000", total_paid: "840000", recovery_rate: "0.7", students_late_count: 4 },
        levels: [{ level_id: "level-6e", level_name: "6e", total_expected_to_date: "600000", total_paid: "420000", students_late_count: 2 }],
        upcomingInstallments: [{ due_date: "2026-05-31", expected_amount: "350000", student_count: 42 }],
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
  test("affiche les indicateurs de présence et le suivi financier", async ({ page }) => {
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
    await expect(page.getByText("Suivi financier")).toBeVisible()
  })

  test("les présences du jour sont présentées dans un tableau", async ({ page }) => {
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

    await expect(page.getByRole("columnheader", { name: "Heure" })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("columnheader", { name: "Professeur" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Matière" })).toBeVisible()
    await expect(page.getByText("Mme Konate")).toBeVisible()
  })

  test("ne présente plus les anciennes vues comme des onglets internes", async ({ page }) => {
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

    await expect(page.getByText("Vue de pilotage", { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("tab")).toHaveCount(0)
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
