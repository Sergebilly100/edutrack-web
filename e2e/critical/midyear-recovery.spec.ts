import { createRequire } from "node:module"
import { expect, test, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

// The real API harness provides ExcelJS, avoiding a second runtime dependency in the PWA.
const apiRequire = createRequire(new URL("../../../edutrack-api/package.json", import.meta.url))
const ExcelJS: typeof import("../../../edutrack-api/node_modules/exceljs") = apiRequire("exceljs")
const api = () => process.env.E2E_API_URL!
async function file(headers: string[], rows: Array<Array<string | number>>) {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("École")
  sheet.addRow(headers); for (const row of rows) sheet.addRow(row)
  return { name: "ecole.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) }
}
async function login(page: Page, admin = true) {
  await returningUser(page)
  await page.goto(admin ? "/admin/login" : "/login")
  await page.getByLabel("Identifiant", { exact: true }).fill(admin ? "superadmin.integration@edutrack.local" : "2250701234567")
  await page.getByLabel("Mot de passe", { exact: true }).fill(admin ? "SuperAdmin!2024" : "director2024")
  const response = page.waitForResponse((r) => r.url().includes("/auth/login/") && r.request().method() === "POST")
  await page.getByRole("button", { name: "Se connecter" }).click()
  const result = await response; expect(result.status()).toBe(200)
  await expect(page).toHaveURL(admin ? /\/admin$/ : /\/dashboard$/)
  return (await result.json()).accessToken as string
}

for (const device of [{ label: "Android", width: 393, height: 851, mobile: true }, { label: "bureau", width: 1280, height: 900, mobile: false }]) {
  test.describe(device.label, () => {
    test.use({ viewport: { width: device.width, height: device.height }, isMobile: device.mobile, hasTouch: device.mobile })
    test("C8 : fiche école, année explicite, aperçu, erreurs et confirmation", async ({ page }) => {
      const token = await login(page)
      const headers = { authorization: `Bearer ${token}` }
      const schools = await page.request.get(`${api()}/admin/schools`, { headers, params: { search: "École QA navigateur" } })
      expect(schools.ok()).toBeTruthy()
      const tenantId = (await schools.json()).schools[0].tenantId
      const enabled = await page.request.patch(`${api()}/admin/schools/${tenantId}/mid-year-flag`, { headers, data: { enabled: true } })
      expect(enabled.ok()).toBeTruthy()
      const base = `${api()}/admin/schools/${tenantId}/midyear-import/students`
      const source = ["Identifiant élève", "Nom", "Prénom", "Niveau", "Classe"]
      const targets = ["matricule", "nom", "prenom", "niveau", "classe"]
      const mapping = await page.request.put(`${base}/profile`, { headers, data: { fields: targets.map((targetField, index) => ({ targetField, sourceColumnLabel: source[index], translations: [] })) } })
      expect(mapping.ok()).toBeTruthy()
      const code = `C8-BROWSER-${device.label}-${Date.now()}`
      const group = `Classe reprise ${device.label}`
      const xlsx = await file(source, [[code, "Koné", "Aya", "Niveau QA", group], [`BAD-${code}`, "", "Ali", "Niveau QA", "Classe invalide"]])
      const menu = page.getByRole("button", { name: "Ouvrir le menu de navigation" })
      await expect(menu.or(page.getByRole("link", { name: "Écoles", exact: true })).first()).toBeVisible()
      if (await menu.isVisible()) { await menu.click(); await expect(page.getByRole("dialog")).toBeVisible() }
      await page.getByRole("link", { name: "Écoles", exact: true }).first().click()
      await page.getByPlaceholder("Rechercher une école").fill("École QA navigateur")
      await page.getByRole("row", { name: /École QA navigateur/ }).first().getByRole("button", { name: "Voir détail" }).click()
      await expect(page).toHaveURL(new RegExp(`/admin/schools/${tenantId}`))
      await page.getByRole("tab", { name: "Imports de l’école" }).click()
      await expect(page.getByText("École sélectionnée : École QA navigateur")).toBeVisible()
      await expect(page.getByLabel(/Fichier Excel/)).toBeDisabled()
      await page.getByRole("combobox", { name: "Année scolaire concernée" }).click()
      await page.getByRole("option", { name: /QA \d{4}/ }).click()
      await page.getByRole("button", { name: /Élèves et inscriptions/ }).click()
      await page.getByLabel(/Fichier Excel/).setInputFiles(xlsx)
      await page.getByRole("button", { name: "Analyser les colonnes" }).click()
      await expect(page.getByText("Correspondance des colonnes")).toBeVisible()
      await expect(page.getByRole("button", { name: "Lancer l’import définitif" })).toBeDisabled()
      await page.getByRole("button", { name: "Prévisualiser la reprise" }).click()
      await expect(page.getByText("Impact avant confirmation")).toBeVisible()
      await expect(page.getByText(/nom manquant/)).toBeVisible()
      await expect(page.getByText(group, { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Lancer l’import définitif" })).toBeDisabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.getByLabel(/Je confirme cet impact/).scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath(`apercu-${device.label}.png`), fullPage: true })
      await page.getByLabel(/Je confirme cet impact/).check()
      const written = page.waitForResponse((r) => r.url().includes("/midyear-import/students/confirm") && r.request().method() === "POST")
      await page.getByRole("button", { name: "Lancer l’import définitif" }).click()
      const response = await written; expect(response.status()).toBe(200)
      expect((await response.json()).impact).toMatchObject({ profilesCreated: 1, classesCreated: 1, enrollmentsCreated: 1 })
      await expect(page.getByText(/Reprise terminée :/)).toBeVisible()
      // Horizontal tables scroll within their containers, never the whole mobile page.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: test.info().outputPath(`reprise-${device.label}.png`), fullPage: true })
    })
  })
}

test("C8 : un directeur ne découvre pas la reprise par menu, onboarding ou URL", async ({ page }) => {
  const adminToken = await login(page)
  const schools = await page.request.get(`${api()}/admin/schools`, { headers: { authorization: `Bearer ${adminToken}` }, params: { search: "École QA navigateur" } })
  const tenantId = (await schools.json()).schools[0].tenantId
  await page.context().clearCookies()
  await login(page, false)
  await expect(page.getByRole("tab", { name: "Imports de l’école" })).toHaveCount(0)
  await page.evaluate(() => { window.history.pushState({}, "", "/onboarding"); window.dispatchEvent(new PopStateEvent("popstate")) })
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText("Importer les données de l’école", { exact: true })).toHaveCount(0)
  const adminRequests: string[] = []
  page.on("request", (r) => { if (r.url().includes("/api/v1/admin/schools/")) adminRequests.push(r.url()) })
  await page.evaluate((id) => { window.history.pushState({}, "", `/admin/schools/${id}`); window.dispatchEvent(new PopStateEvent("popstate")) }, tenantId)
  await expect(page.getByText("Cette page est réservée au super admin.")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Imports de l’école" })).toHaveCount(0)
  expect(adminRequests).toEqual([])
})

test("Imports de l’école : un seul onglet, activation et désactivation sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  const token = await login(page)
  const headers = { authorization: `Bearer ${token}` }
  const response = await page.request.get(`${api()}/admin/schools`, { headers, params: { search: "École QA navigateur" } })
  const tenantId = (await response.json()).schools[0].tenantId
  expect((await page.request.patch(`${api()}/admin/schools/${tenantId}/mid-year-flag`, { headers, data: { enabled: false } })).ok()).toBeTruthy()
  await page.goto(`/admin/schools/${tenantId}?tab=imports`)
  const tab = page.getByRole("tab", { name: "Imports de l’école" })
  await expect(tab).toHaveAttribute("data-state", "active")
  await expect(page.getByRole("tab", { name: "Données professeurs" })).toHaveCount(0)
  await expect(page.getByRole("tab", { name: "Reprise de données" })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Imports de l’école" })).toHaveCount(1)
  await expect(page.getByRole("button", { name: /^6 · Professeurs : affectations$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /Élèves et inscriptions/ })).toHaveCount(0)
  const activation = page.getByRole("checkbox", { name: "Activer la reprise en cours d’année" })
  await activation.click()
  await expect(activation).toBeChecked()
  await expect(page.getByRole("button", { name: /Élèves et inscriptions/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /Paiements déjà reçus/ })).toBeVisible()
  await expect(tab).toHaveAttribute("data-state", "active")
  await page.getByRole("combobox", { name: "Année scolaire concernée" }).click()
  await page.getByRole("option", { name: /QA \d{4}/ }).click()
  await page.getByLabel(/Fichier Excel/).setInputFiles(await file(["Nom"], [["Brouillon non importé"]]))
  await activation.click()
  await expect(activation).not.toBeChecked()
  await expect(page.getByRole("button", { name: /Élèves et inscriptions/ })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Importer les affectations des professeurs" })).toBeVisible()
  await expect(page.getByLabel(/Fichier Excel/)).toBeDisabled()
  expect(await page.getByLabel(/Fichier Excel/).evaluate((element) => (element as HTMLInputElement).files?.length)).toBe(0)
  await expect(tab).toHaveAttribute("data-state", "active")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await activation.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath("imports-ecole-mobile.png"), fullPage: true })
})
