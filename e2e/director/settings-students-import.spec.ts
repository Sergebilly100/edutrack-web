import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const mockNavigationApis = async (page: import("@playwright/test").Page) => {
  // Page élèves — liste des élèves
  await page.route("**/api/v1/students*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      }),
    })
  })

  // Page élèves — classes (via schedule/weekly ou classes)
  await page.route("**/api/v1/schedule/weekly*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-06-06",
        period: null,
        schedules: [],
        teachers: [],
        classes: [],
        rooms: [],
        time_slots: [],
      }),
    })
  })

  // Page settings — config école
  await page.route("**/api/v1/permissions/config*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        school: {
          name: "École Sainte-Marie",
          subdomain: "sainte-marie",
          plan: "premium",
          city: "Abidjan",
          teachingType: "secondaire",
          maxUsers: 10,
          currentUsers: 2,
          totalUsers: 2,
          adminUsersCount: 2,
          logoUrl: null,
          activeSchoolYear: "2025-2026",
          canEditSmsTemplate: true,
          allowTeacherQrSkip: false,
        },
        limits: { maxAdminPositions: 5 },
        positions: [],
        users: [],
      }),
    })
  })
  await page.route("**/api/v1/settings/sms-price*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        is_enabled: true,
        monetize_parent_alerts: false,
        commission_pct: 10,
        sms_unit_price_fcfa: 10,
      }),
    })
  })

  // Page import — historique
  await page.route("**/api/v1/import/history*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  })

  // Subscription config (utilisé dans settings)
  await page.route("**/api/v1/subscriptions/school-config*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isEnabled: false }),
    })
  })
}

test.describe("Directeur - settings/students/import", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
    await mockNavigationApis(page)
  })

  test("navigation vers la page élèves", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Élèves" }).click()

    await expect(page).toHaveURL(/\/students/)
    await expect(page.getByRole("tab", { name: "Liste" })).toBeVisible()
  })

  test("navigation vers la page paramètres", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Paramètres" }).click()

    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByText("Paramètres école")).toBeVisible()
    await expect(page.getByText("Informations école")).toBeVisible()
  })

  test("navigation vers la page import", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Import" }).click()

    await expect(page).toHaveURL(/\/import/)
    await expect(page.getByRole("heading", { name: "Import de données" })).toBeVisible()
    await expect(page.getByText("Historique des imports")).toBeVisible()
  })
})
