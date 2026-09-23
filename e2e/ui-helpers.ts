import { expect, type Page } from "@playwright/test"

// These workflows use an account that has already dismissed the product tours.
// Tour discovery itself remains part of the manual first-login checklist.
export async function returningUser(page: Page) {
  await page.addInitScript(() => {
    for (const tour of ["dashboard", "validations", "teachers", "teacher-detail", "students", "student-detail", "schedule", "salaries", "subscriptions", "subscription-revenue", "settings", "rooms", "import", "teacher-app", "teacher-dashboard", "parent-portal"]) {
      localStorage.setItem(`ivoiredu-tour-done-${tour}`, "1")
    }
  })
}

export async function navigateMenu(page: Page, group: string, label: string) {
  const open = page.getByRole("button", { name: "Ouvrir le menu de navigation" })
  const toggle = page.getByRole("button", { name: group, exact: true })
  await expect(open.or(toggle).first()).toBeVisible()
  if (await open.isVisible()) await open.click()
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click()
  await page.getByRole("link", { name: label, exact: true }).click()
}
