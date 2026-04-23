import { expect, type Page } from "@playwright/test"

const STAFF_IDENTIFIER = process.env.E2E_STAFF_IDENTIFIER ?? "secretariat@sainte-marie.ci"
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD ?? "Test1234!"
const TENANT_SCHEMA = process.env.E2E_SCHEMA_NAME ?? "school_sainte_marie"

export const loginAsStaffUI = async (page: Page) => {
  await page.goto("/login")

  await page.getByLabel("Identifiant").fill(STAFF_IDENTIFIER)
  await page.getByLabel("Mot de passe").fill(STAFF_PASSWORD)
  await page.getByLabel("Schéma tenant").fill(TENANT_SCHEMA)
  await page.getByRole("button", { name: "Se connecter" }).click()

  await page.waitForURL(/\/(dashboard|onboarding)/)
  if (page.url().includes("/onboarding")) {
    await page.goto("/dashboard")
  }

  await expect(page).toHaveURL(/\/dashboard/)
}
