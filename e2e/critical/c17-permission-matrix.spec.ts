import { expect, test, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

async function loginDirector(page: Page) {
  await returningUser(page)
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill("2250701234567")
  await page.getByLabel("Mot de passe", { exact: true }).fill("director2024")
  const pending = page.waitForResponse((response) =>
    response.url().includes("/auth/login/") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  return (await response.json() as { accessToken: string }).accessToken
}

test("C14 : la matrice réelle expose le catalogue API et persiste les dépendances", async ({ page }) => {
  const token = await loginDirector(page)
  const headers = { authorization: `Bearer ${token}` }
  await page.goto("/settings?tab=personnel")
  const catalogueResponse = await page.request.get(`${process.env.E2E_API_URL}/permissions/catalogue`, { headers })
  expect(catalogueResponse.status()).toBe(200)
  const catalogue = await catalogueResponse.json() as { permissions: Array<{ key: string }> }

  await page.getByRole("button", { name: "Nouveau poste" }).click()
  const dialog = page.getByRole("dialog")
  const groups = dialog.getByRole("button", { name: /^Permissions : / })
  for (const group of await groups.all()) await group.click()
  const keys = await dialog.locator("[data-permission-key]").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-permission-key")))
  expect(keys).toEqual(catalogue.permissions.map((permission) => permission.key))
  expect(new Set(keys).size).toBe(keys.length)

  await dialog.locator('[data-permission-key="attendance.mark_students"] label').click()
  await expect(dialog.getByRole("checkbox", { name: "Voir les présences", exact: true })).toBeChecked()
  await expect(dialog.getByRole("checkbox", { name: "Voir les présences", exact: true })).toBeDisabled()
  const name = `Poste C17 ${Date.now()}`
  await dialog.getByLabel("Nom du poste").fill(name)
  const saved = page.waitForResponse((response) =>
    response.url().endsWith("/permissions/positions") && response.request().method() === "POST")
  await dialog.getByRole("button", { name: "Créer le poste" }).click()
  expect((await saved).status()).toBe(201)
  await expect(dialog).toHaveCount(0)
  const positions = await page.request.get(`${process.env.E2E_API_URL}/permissions/config`, { headers })
  expect(positions.status()).toBe(200)
  const config = await positions.json() as { positions: Array<{ name: string; permissions: string[] }> }
  expect(config.positions.find((position) => position.name === name)?.permissions)
    .toEqual(expect.arrayContaining(["attendance.mark_students", "attendance.view"]))
})
