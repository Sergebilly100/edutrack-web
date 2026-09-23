import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

// A parent with linked children must be seeded; passwords are no longer derived from the phone.
test("setup parent auth state", async ({ page }) => {
  const phone = process.env.E2E_PARENT_PHONE
  const password = process.env.E2E_PARENT_PASSWORD
  if (!phone || !password) throw new Error("Set E2E_PARENT_PHONE / E2E_PARENT_PASSWORD, or use npm run e2e:qa")
  await mkdir("e2e/.auth", { recursive: true })
  await returningUser(page)
  await page.goto("/parent/login")
  await page.getByLabel("Numéro de téléphone").fill(phone)
  await page.getByLabel("Mot de passe", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page).toHaveURL(/\/parent\/dashboard$/)
  await page.context().storageState({ path: "e2e/.auth/parent.json" })
})
