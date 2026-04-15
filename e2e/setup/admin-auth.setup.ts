import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth")

const loginAndSaveState = async (input: {
  identifier: string
  password: string
  schemaName: string
  expectedPath: string
  storagePath: string
}, page: Page) => {
  await page.goto("/login")
  await page.getByLabel("Identifiant").fill(input.identifier)
  await page.getByLabel("Mot de passe").fill(input.password)
  await page.getByLabel("Schéma tenant").fill(input.schemaName)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await page.waitForURL(`**${input.expectedPath}**`)
  await expect(page).toHaveURL(new RegExp(input.expectedPath.replace("/", "\\/")))
  await page.context().storageState({ path: input.storagePath })
}

test.skip(process.env.E2E_RUN_AUTH_SETUP !== "true", "Set E2E_RUN_AUTH_SETUP=true to run real auth setup")

test("setup admin auth state", async ({ page }) => {
  await mkdir(AUTH_DIR, { recursive: true })
  const storagePath = path.join(AUTH_DIR, "admin.json")

  await loginAndSaveState(
    {
      identifier: process.env.E2E_ADMIN_IDENTIFIER ?? "admin@edutrack.ci",
      password: process.env.E2E_ADMIN_PASSWORD ?? "Test1234!",
      schemaName: process.env.E2E_ADMIN_SCHEMA_NAME ?? "public",
      expectedPath: "/admin",
      storagePath,
    },
    page
  )
})
