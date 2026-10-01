import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

test("C26 : une erreur de calendrier ne propose pas de créer une période sur mobile", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const user = { id: "director-c26", role: "director", name: "Directeur C26", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false }
    if (pathname.endsWith("/grading-periods")) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Calendrier indisponible" }) })
      return
    }
    const payload = pathname.endsWith("/auth/refresh") ? { accessToken: "token-c26", tokenType: "Bearer", expiresIn: 3600, user }
      : pathname.endsWith("/auth/me") ? { user, tenant: { id: "tenant-c26", status: "active", trialEndsAt: null } }
      : pathname.endsWith("/permissions/me") ? { permissions: ["school_years.view", "school_years.edit"] }
      : pathname.endsWith("/school/info") ? { onboarding_completed: true }
      : pathname.endsWith("/school-years") ? { schoolYears: [{
          id: "11111111-1111-4111-8111-111111111111", label: "2026-2027", status: "active",
          startDate: "2026-09-01", endDate: "2027-06-30", endOfYearReviewStartDate: "2027-05-31",
          gradingPeriodType: "semester",
        }] }
      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto("/academic/school-years")
  await expect(page.getByRole("heading", { name: "Structure scolaire" })).toBeVisible()
  await expect(page.getByRole("alert").filter({ hasText: "Données indisponibles" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible()
  await expect(page.getByText("Ajouter la période 1")).toHaveCount(0)

  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
