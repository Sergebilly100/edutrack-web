import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const year = { id: "11111111-1111-4111-8111-111111111111", label: "2026-2027", status: "active" }
const level = { id: "22222222-2222-4222-8222-222222222222", name: "6ème", orderIndex: 1 }
const classes = [
  { id: "33333333-3333-4333-8333-333333333333", name: "6ème A", studentCount: 0, isActive: true, level, schoolYear: year, homeroomTeacher: null },
  { id: "44444444-4444-4444-8444-444444444444", name: "6ème B", studentCount: 1, isActive: true, level, schoolYear: year, homeroomTeacher: null },
]

test("C25 : les cartes de classe montrent seulement l'effectif confirmé à 320, 360 et 393 px", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const user = { id: "director-c25", role: "director", name: "Directeur C25", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false }
    const payload = pathname.endsWith("/auth/refresh") ? { accessToken: "token-c25", tokenType: "Bearer", expiresIn: 3600, user }
      : pathname.endsWith("/auth/me") ? { user, tenant: { id: "tenant-c25", status: "active", trialEndsAt: null } }
      : pathname.endsWith("/permissions/me") ? { permissions: ["classes.view", "school_years.view", "levels.view"] }
      : pathname.endsWith("/school/info") ? { onboarding_completed: true }
      : pathname.endsWith("/school-years") ? { schoolYears: [year] }
      : pathname.endsWith("/levels") ? { levels: [level] }
      : pathname.endsWith("/classes") ? { schoolYear: year, activeSchoolYear: year, classes }
      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto("/academic/classes")
  await expect(page.getByRole("heading", { name: "Structure scolaire" })).toBeVisible()

  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.getByRole("listitem").filter({ hasText: "6ème A" })).toContainText("0 élève confirmé")
    await expect(page.getByRole("listitem").filter({ hasText: "6ème B" })).toContainText("1 élève confirmé")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole("button", { name: "Ajouter une classe" }).click()
    const dialog = page.getByRole("dialog", { name: "Ajouter une classe" })
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true)
    await dialog.getByRole("button", { name: "Annuler" }).click()
  }
})
