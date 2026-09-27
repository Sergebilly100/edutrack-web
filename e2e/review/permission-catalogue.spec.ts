import { expect, test, type Page } from "@playwright/test"
import { mockDirectorAuth } from "../director/helpers"
import { buildPermissionCatalogue } from "../../../edutrack-api/src/modules/permissions/permissions.catalogue"
import { PERMISSION_KEYS } from "../../../edutrack-api/src/modules/permissions/permissions.types"

async function mockSettings(page: Page, staff = false) {
  await page.route("https://example.test/**", (route) => route.fulfill({ contentType: "image/png", body: "" }))
  await page.route("**/api/v1/**", (route) => route.fulfill({ json: { data: [], total: 0 } }))
  await mockDirectorAuth(page)
  const school = {
    name: "École C14", subdomain: "ecole-c14", city: "Abidjan", address: "Rue des écoles", plan: "pro",
    maxUsers: 100, canEditSmsTemplate: false, allowTeacherQrSkip: false, logoUrl: null,
  }
  await page.route("**/api/v1/settings/sms-price*", (route) => route.fulfill({ json: { is_enabled: false, monetize_parent_alerts: false, use_real_hours: false } }))
  await page.route("**/api/v1/permissions/config", (route) => route.fulfill({ json: { school, positions: [], users: [], limits: { maxAdminPositions: 10 } } }))
  await page.route("**/api/v1/permissions/config/school", (route) => route.fulfill({ json: { school } }))
  await page.route("**/api/v1/permissions/catalogue", (route) => route.fulfill({ json: buildPermissionCatalogue({
    canEditSmsTemplate: false, smsEnabled: false, monetizeParentAlerts: false,
  }) }))
  if (staff) {
    await page.route("**/api/v1/auth/me*", (route) => route.fulfill({ json: {
      user: { id: "staff-c14", role: "staff", name: "Gestion école", mustChangePassword: false },
      tenant: { id: "tenant-c14", status: "active" },
    } }))
    await page.route("**/api/v1/permissions/me*", (route) => route.fulfill({ json: { permissions: ["settings.school"] } }))
  }
}

for (const width of [360, 393, 1280]) {
  test(`catalogue exhaustif, indisponibilités et cibles tactiles à ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 })
    await mockSettings(page)
    await page.goto("/settings?tab=personnel")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    const dialog = page.getByRole("dialog")
    const domainTriggers = dialog.getByRole("button", { name: /^Permissions : / })
    const domainCount = new Set(buildPermissionCatalogue({ canEditSmsTemplate: false, smsEnabled: false, monetizeParentAlerts: false }).permissions.map((entry) => entry.domain)).size
    await expect(domainTriggers).toHaveCount(domainCount)
    for (const trigger of await domainTriggers.all()) {
      await expect(trigger).toHaveAttribute("aria-expanded", "false")
      await trigger.click()
    }
    await expect(dialog.locator("[data-permission-key]")).toHaveCount(PERMISSION_KEYS.length)
    const keys = await dialog.locator("[data-permission-key]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-permission-key")))
    expect(keys).toEqual(PERMISSION_KEYS)
    await expect(dialog.getByRole("checkbox", { name: "Modifier les modèles SMS" })).toBeDisabled()
    await expect(dialog.getByRole("checkbox", { name: "Voir les abonnements parents" })).toBeDisabled()
    await expect(dialog.getByRole("checkbox", { name: "Voir les abonnements parents" })).not.toBeChecked()
    await dialog.locator('[data-permission-key="attendance.mark_students"] label').click()
    await expect(dialog.getByRole("checkbox", { name: "Voir les présences", exact: true })).toBeChecked()
    await expect(dialog.getByRole("checkbox", { name: "Voir les présences", exact: true })).toBeDisabled()
    await dialog.locator('[data-permission-key="subscriptions.revenue"]').scrollIntoViewIfNeeded()
    await expect(dialog.getByRole("checkbox", { name: "Voir les revenus et commissions des abonnements" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Créer le poste" })).toBeVisible()
    const checkboxes = await dialog.getByRole("checkbox").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      const labelRect = element.closest("label")!.getBoundingClientRect()
      return { width: rect.width, height: rect.height, targetWidth: labelRect.width, targetHeight: labelRect.height }
    }))
    expect(checkboxes.every((checkbox) => checkbox.width === 16 && checkbox.height === 16)).toBe(true)
    expect(checkboxes.every((checkbox) => checkbox.targetWidth >= 48 && checkbox.targetHeight >= 48)).toBe(true)
    const triggerSizes = await domainTriggers.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }))
    expect(triggerSizes.every((size) => size.width >= 48 && size.height >= 48)).toBe(true)
    const subscriptionTrigger = dialog.getByRole("button", { name: "Permissions : Abonnements parents" })
    await subscriptionTrigger.focus()
    await page.keyboard.press("Enter")
    await expect(subscriptionTrigger).toHaveAttribute("aria-expanded", "false")
    await page.keyboard.press("Space")
    await expect(subscriptionTrigger).toHaveAttribute("aria-expanded", "true")
    for (const trigger of await domainTriggers.all()) await trigger.click()
    await expect(dialog.getByRole("checkbox", { name: "Marquer les présences des élèves" })).toHaveCount(0)
    await dialog.getByRole("button", { name: "Permissions : Présences" }).click()
    await expect(dialog.getByRole("checkbox", { name: "Marquer les présences des élèves" })).toBeChecked()
    await expect(dialog.getByRole("button", { name: "Permissions : Présences" })).toContainText("2/2")
    await dialog.getByLabel("Nom du poste").scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`catalogue-${width}.png`) })
  })
}

test("settings.school charge et modifie l’école sans aucune requête administrative", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 850 })
  await mockSettings(page, true)
  const attempted: string[] = []
  const writes: unknown[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path === "/api/v1/permissions/config" || /\/permissions\/(positions|users|catalogue)/.test(path)) attempted.push(path)
  })
  await page.route("**/api/v1/permissions/config/school", async (route) => {
    if (route.request().method() === "PATCH") writes.push(route.request().postDataJSON())
    await route.fulfill({ json: { school: { name: "École C14", plan: "pro", address: "Rue des écoles", logoUrl: null } } })
  })
  await page.goto("/settings?tab=general")
  await expect(page.getByRole("tab", { name: "Général" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tab", { name: "Personnel" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Nouveau poste" })).toHaveCount(0)
  await page.getByPlaceholder("https://...", { exact: true }).fill("https://example.test/logo.png")
  await page.getByRole("button", { name: "Enregistrer l'URL" }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toEqual({ logoUrl: "https://example.test/logo.png" })
  expect(attempted).toEqual([])
})

test("le refus du catalogue est visible et empêche une sauvegarde", async ({ page }) => {
  await mockSettings(page)
  const attempted: string[] = []
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/permissions/positions")) attempted.push(request.url()) })
  await page.route("**/api/v1/permissions/catalogue", (route) => route.fulfill({ status: 403, json: { error: "Permission requise", code: "FORBIDDEN", statusCode: 403 } }))
  await page.goto("/settings?tab=personnel")
  await page.getByRole("button", { name: "Nouveau poste" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("alert")).toContainText("Votre poste ne permet pas de consulter ou gérer les permissions.")
  await expect(dialog.getByRole("button", { name: "Créer le poste" })).toBeDisabled()
  expect(attempted).toEqual([])
})
