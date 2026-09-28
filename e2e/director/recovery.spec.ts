import { expect, test } from "@playwright/test"
import { mockDirectorAuth } from "./helpers"

const metrics = { studentCount: 1, expected: 100000, paid: 30000, waived: 20000, remaining: 50000, recoveryRate: 0.3, studentsToFollow: 1 }

for (const width of [320, 360, 393]) {
  test(`recouvrement détaillé reste contenu à ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 })
    await mockDirectorAuth(page)
    await page.route("**/api/v1/finance/recovery*", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ schoolYearId: "year-1", school: metrics, selection: metrics, levels: [{ ...metrics, levelId: "level-1", levelName: "6e" }], classes: [{ ...metrics, classId: "class-1", className: "6e A", levelId: "level-1", levelName: "6e" }] }),
    }))
    await page.route("**/api/v1/finance/recovery/years", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ years: [{ id: "year-1", label: "2026-2027", status: "active" }] }),
    }))
    await page.route("**/api/v1/finance/recovery/class-students?*", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ students: [{ studentId: "student-1", name: "Awa Koné", matricule: "MAT-1", status: "late", expected: 100000, paid: 30000, waived: 20000, remaining: 50000, daysLate: 4 }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    }))
    await page.goto("/finance/recovery")
    await expect(page.getByRole("heading", { name: "Recouvrement détaillé" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Voir les élèves de 6e A" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.getByRole("button", { name: "Voir les élèves de 6e A" }).click()
    await expect(page.getByText("Awa Koné")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const tables = page.locator("table")
    expect(await tables.count()).toBe(3)
    for (const table of await tables.all()) {
      const container = table.locator("xpath=..").first()
      expect(await container.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    }
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await expect(page.getByRole("dialog", { name: "Navigation principale" }).getByRole("link", { name: "Recouvrement détaillé" })).toBeVisible()
  })
}
