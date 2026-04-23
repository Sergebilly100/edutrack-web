import { expect, type Page } from "@playwright/test"

const STAFF_IDENTIFIER = process.env.E2E_STAFF_IDENTIFIER ?? "secretariat@sainte-marie.ci"
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD ?? "Test1234!"
const TENANT_SCHEMA = process.env.E2E_SCHEMA_NAME ?? "school_sainte_marie"

export const loginAsStaffUI = async (page: Page) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/login")
    await page.waitForURL(/\/(login|dashboard|onboarding)(\/|\?|$)/, { timeout: 15000 })

    if (page.url().includes("/login")) {
      await expect(page.getByLabel("Identifiant")).toBeVisible()
      await page.getByLabel("Identifiant").fill(STAFF_IDENTIFIER)
      await page.getByLabel("Mot de passe").fill(STAFF_PASSWORD)
      await page.getByLabel("Schéma tenant").fill(TENANT_SCHEMA)
      await page.getByRole("button", { name: "Se connecter" }).click()
    }

    try {
      await page.waitForURL(/\/(dashboard|onboarding)(\/|\?|$)/, { timeout: 25000 })
      break
    } catch (error) {
      if (attempt === 1) {
        throw error
      }
    }
  }

  if (page.url().includes("/onboarding")) {
    await page.getByRole("link", { name: "Dashboard" }).first().click()
    await page.waitForURL(/\/dashboard(\/|\?|$)/, { timeout: 10000 })
  }

  await expect(page).toHaveURL(/\/dashboard/)
}
