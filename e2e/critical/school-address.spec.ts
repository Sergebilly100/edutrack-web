import { createRequire } from "node:module"
import { expect, test, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const api = () => process.env.E2E_API_URL!
const apiRequire = createRequire(new URL("../../../edutrack-api/package.json", import.meta.url))
const { Client } = apiRequire("pg") as typeof import("../../../edutrack-api/node_modules/pg")
test.describe.configure({ mode: "serial" })

async function login(page: Page, role: "admin" | "director", identifier: string, password: string) {
  await returningUser(page)
  await page.goto(role === "admin" ? "/admin/login" : "/login")
  await page.getByLabel("Identifiant", { exact: true }).fill(identifier)
  await page.getByLabel("Mot de passe", { exact: true }).fill(password)
  const pending = page.waitForResponse((response) => response.url().includes("/auth/login/") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  const response = await pending
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json() as { accessToken: string }).accessToken
}

test("C15 : super administration et relecture directeur", async ({ page }) => {
  test.setTimeout(60000)
  const adminToken = await login(page, "admin", "superadmin.integration@edutrack.local", "SuperAdmin!2024")
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
  await page.getByRole("link", { name: "Écoles", exact: true }).first().click()
  await page.getByRole("button", { name: "Créer une école" }).click()
  const dialog = page.getByRole("dialog", { name: "Nouvelle école" })
  const suffix = `${Date.now()}`
  const subdomain = `c15-${suffix}`
  const directorPhone = `22507${suffix.slice(-8)}`
  await dialog.getByLabel("Nom", { exact: true }).fill(`École C15 ${suffix}`)
  await dialog.getByLabel("Sous-domaine").fill(subdomain)
  await dialog.getByLabel("Ville").fill("Abidjan")
  await dialog.getByLabel("Adresse").fill("Rue C15, Cocody")
  await dialog.getByRole("combobox").nth(0).click()
  await page.getByRole("option", { name: "Secondaire" }).click()
  await dialog.getByLabel("Nom complet").fill("Directeur C15")
  await dialog.getByLabel("Téléphone").fill(directorPhone)
  const year = new Date().getUTCFullYear()
  await dialog.getByLabel("Année scolaire active").fill(`09/${year} - 06/${year + 1}`)
  const created = page.waitForResponse((response) => response.url().endsWith("/admin/schools") && response.request().method() === "POST")
  await dialog.getByRole("button", { name: "Créer l'école" }).click()
  const creation = await created
  expect(creation.status(), await creation.text()).toBe(201)
  const tenantId = (await creation.json() as { tenantId: string }).tenantId
  const directorPassword = await dialog.getByText("Mot de passe généré").locator("..").locator("dd").innerText()
  await dialog.getByRole("button", { name: "Accéder à la config école" }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/schools/${tenantId}`))
  const address = page.getByText("Adresse", { exact: true }).locator("..").getByRole("textbox")
  await expect(address).toHaveValue("Rue C15, Cocody")
  await address.fill("Boulevard C15, Cocody")
  const changed = page.waitForResponse((response) => response.url().endsWith(`/admin/schools/${tenantId}/config`) && response.request().method() === "PATCH")
  await page.getByRole("button", { name: "Enregistrer la configuration" }).click()
  expect((await changed).status()).toBe(200)
  const details = await page.request.get(`${api()}/admin/schools/${tenantId}`, { headers: { authorization: `Bearer ${adminToken}` } })
  expect((await details.json()).metadata.address).toBe("Boulevard C15, Cocody")

  const createdSchema = `school_${subdomain.replaceAll("-", "_")}`
  const directorLogin = await page.request.post(`${api()}/auth/login/teacher`, {
    headers: { "x-tenant-schema": createdSchema },
    data: { identifier: directorPhone, password: directorPassword },
  })
  expect(directorLogin.status(), await directorLogin.text()).toBe(200)
  const directorToken = (await directorLogin.json() as { accessToken: string }).accessToken
  const directorInfo = await page.request.get(`${api()}/school/info`, {
    headers: { authorization: `Bearer ${directorToken}`, "x-tenant-schema": createdSchema },
  })
  expect((await directorInfo.json()).address).toBe("Boulevard C15, Cocody")
})

test("C15 : onboarding directeur et persistance après rechargement", async ({ page }) => {
  await login(page, "director", "2250701234567", "director2024")
  await page.goto("/onboarding")
  await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue("")
  await page.getByLabel("Adresse", { exact: true }).fill("Avenue C15, Marcory")
  const saved = page.waitForResponse((response) => response.url().endsWith("/school/info") && response.request().method() === "PATCH")
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await page.getByRole("button", { name: "1. Infos école" }).click()
  await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue("Avenue C15, Marcory")
})

test("C15 : paramètres directeur sur école historique sans adresse", async ({ page }) => {
  test.setTimeout(60000)
  const token = await login(page, "director", "2250701234567", "director2024")
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { schemaName: string }
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST })
  await client.connect()
  try {
    const reset = await client.query('UPDATE public.tenants SET address=NULL WHERE schema_name=$1', [claims.schemaName])
    expect(reset.rowCount).toBe(1)
  } finally {
    await client.end()
  }
  await page.goto("/settings")
  const address = page.getByLabel("Adresse", { exact: true })
  await expect(address).toHaveValue("")
  await page.getByRole("button", { name: "Activer le mode facultatif" }).click()
  await page.getByRole("button", { name: /Confirmer/ }).click()
  const headers = { authorization: `Bearer ${token}` }
  const noAddress = await page.request.get(`${api()}/school/info`, { headers })
  expect((await noAddress.json()).address).toBe("")
  await address.fill("Rue C15, Plateau")
  const saved = page.waitForResponse((response) => response.url().endsWith("/permissions/config/school") && response.request().method() === "PATCH")
  await page.getByRole("button", { name: "Enregistrer l’adresse" }).click()
  const response = await saved
  expect(response.request().postDataJSON()).toMatchObject({ address: "Rue C15, Plateau" })
  expect(response.status(), await response.text()).toBe(200)
  const savedInfo = await page.request.get(`${api()}/school/info`, { headers: { ...headers, "x-tenant-schema": claims.schemaName } })
  expect((await savedInfo.json()).address).toBe("Rue C15, Plateau")
  const reloadedConfig = await page.request.get(`${api()}/permissions/config`, { headers: { ...headers, "x-tenant-schema": claims.schemaName } })
  expect((await reloadedConfig.json()).school.address).toBe("Rue C15, Plateau")
  await page.reload()
  await expect(page.getByLabel("Adresse", { exact: true })).toHaveValue("Rue C15, Plateau")
  const info = await page.request.get(`${api()}/school/info`, { headers })
  expect((await info.json()).address).toBe("Rue C15, Plateau")
})
