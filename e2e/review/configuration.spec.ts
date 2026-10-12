import { expect, test, type Page } from "@playwright/test"
import { mockDirectorAuth } from "../director/helpers"

async function mockSchool(page: Page) {
  // Catch every request, including background queries, to avoid the real API.
  await page.route("**/api/v1/**", (route) => route.fulfill({ json: { data: [], total: 0 } }))
  await mockDirectorAuth(page)
  const responses: Record<string, unknown> = {
    "dashboard/stats": {
      teacherAttendance: { globalRate: 85, partTime: { present: 5, expected: 6, rate: 83 }, fullTime: { present: 10, expected: 11, rate: 91 } },
      studentAttendance: { rate: 92, present: 120, absent: 10, notMarked: 0, total: 130 },
      salaries: { monthlyTotal: 500000, toPayCurrentPeriod: 150000, totalPaid: 50000, remainingToPay: 100000, economy: { label: "Septembre 2026", plannedHours: 40, completedHours: 35, savedAmount: 25000 } },
      subscriptions: { isEnabled: false, collectedAmount: 0, activeSubscribers: 0, collectionRate: 0, expectedAmount: 0 },
    },
    "dashboard/pilotage": {
      population: { activeStudents: 130, activeTeachers: 16, activeClasses: 8 },
      academic: [{ levelId: "level-6e", levelName: "Sixième générale", classCount: 2, expectedSubjects: 12, completedSubjects: 9, completionRate: 75, studentsWithAverage: 46, averageScore: 11.8, performingStudents: 31, attentionStudents: 9, criticalStudents: 6 }],
      risks: { studentAbsences: 3, studentGrades: 2, studentPayments: 4, teacherAbsences: 1 },
    },
    "finance/financial-summary": {
      school: { total_expected_to_date: "1200000", total_paid: "840000", recovery_rate: "0.7", students_late_count: 4 },
      levels: [{ level_id: "level-6e", level_name: "Sixième générale", total_expected_to_date: "600000", total_paid: "420000", students_late_count: 2 }], upcomingInstallments: [],
    },
    "attendance/today": { date: "2026-09-25", presentCount: 0, absentCount: 0, unmarkedCount: 0, courses: [] },
    "schedule/periods": { periods: [] },
    "schedule/weekly": { date: "2026-09-25", period: null, schedules: [], teachers: [], classes: [], rooms: [], time_slots: [] },
    "settings/sms-price": { is_enabled: false, monetize_parent_alerts: false },
    "permissions/config": { school: { name: "École revue", city: "Abidjan", address: "Rue des écoles", plan: "pro" }, users: [], positions: [], limits: {} },
    "school-years": { schoolYears: [] },
    "import/history": { data: [], total: 0, page: 1, limit: 10 },
  }
  for (const [path, response] of Object.entries(responses)) {
    await page.route(`**/api/v1/${path}*`, (route) => route.fulfill({ json: response }))
  }
}

test.beforeEach(async ({ page }) => { await mockSchool(page) })

for (const width of [320, 360, 393]) {
  test(`dashboard lisible sans débordement global à ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 })
    await page.goto("/dashboard")
    await expect(page.getByText("Suivi financier", { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect.poll(() => page.locator("main").evaluate((main) => main.scrollWidth - main.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true })
  })
}

test("l’import contextualisé n’affiche que les onglets disponibles", async ({ page }) => {
  await page.goto("/import?type=schedule")
  const tabs = page.getByRole("tab")
  await expect(tabs.filter({ hasText: "Emploi du temps" })).toHaveAttribute("aria-selected", "true")
  await expect(tabs).toHaveCount(1)
  await expect(tabs.filter({ hasText: "Professeurs" })).toHaveCount(0)
})

test("le lien de configuration des frais ouvre l’onglet Finance", async ({ page }) => {
  await page.goto("/settings?tab=finance")
  await expect(page.getByRole("tab", { name: "Finance", exact: true })).toHaveAttribute("aria-selected", "true")
})

test("un EDT vide renvoie vers l’import EDT sans création manuelle de période", async ({ page }) => {
  await page.goto("/schedule")
  await page.getByRole("button", { name: "Importer l’EDT" }).or(page.getByRole("button", { name: "Importer l'EDT" })).click()
  await expect(page).toHaveURL(/\/import\?type=schedule$/)
  await expect(page.getByRole("tab").filter({ hasText: "Emploi du temps" })).toHaveAttribute("aria-selected", "true")
})
