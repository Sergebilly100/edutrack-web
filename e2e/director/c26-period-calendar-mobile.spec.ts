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

test("UX-07 : frise et tableau restent dans la largeur mobile", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const user = { id: "director-ux07", role: "director", name: "Directeur UX07", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false }
    const payload = pathname.endsWith("/auth/refresh") ? { accessToken: "token-ux07", tokenType: "Bearer", expiresIn: 3600, user }
      : pathname.endsWith("/auth/me") ? { user, tenant: { id: "tenant-ux07", status: "active", trialEndsAt: null } }
      : pathname.endsWith("/permissions/me") ? { permissions: ["school_years.view", "school_years.edit", "class_decisions.view"] }
      : pathname.endsWith("/school/info") ? { onboarding_completed: true }
      : pathname.endsWith("/school-years") ? { schoolYears: [{
          id: "11111111-1111-4111-8111-111111111111", label: "03/2026 - 12/2026", status: "active",
          startDate: "2026-03-12", endDate: "2026-12-17", endOfYearReviewStartDate: "2026-11-17", gradingPeriodType: "trimester",
        }] }
      : pathname.endsWith("/grading-periods") ? { gradingPeriods: [
          { id: "21111111-1111-4111-8111-111111111111", schoolYearId: "11111111-1111-4111-8111-111111111111", label: "Trimestre 1", orderIndex: 1, startDate: "2026-03-12", reviewStartDate: "2026-06-18", endDate: "2026-07-03", isClosed: true, hasGeneratedCards: true, notesEntryOpen: false, conductReviewOpen: false },
          { id: "31111111-1111-4111-8111-111111111111", schoolYearId: "11111111-1111-4111-8111-111111111111", label: "Trimestre 2", orderIndex: 2, startDate: "2026-06-18", reviewStartDate: "2026-09-21", endDate: "2026-09-26", isClosed: true, hasGeneratedCards: true, notesEntryOpen: false, conductReviewOpen: false },
          { id: "41111111-1111-4111-8111-111111111111", schoolYearId: "11111111-1111-4111-8111-111111111111", label: "Trimestre 3", orderIndex: 3, startDate: "2026-09-21", reviewStartDate: "2026-11-17", endDate: "2026-12-17", isClosed: false, hasGeneratedCards: false, notesEntryOpen: true, conductReviewOpen: false },
        ] }
      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto("/academic/school-years")
  await expect(page.getByRole("img", { name: /Trimestre 3 du/ })).toBeVisible()
  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    const timelineWidth = await page.getByRole("img", { name: /Trimestre 3 du/ }).evaluate((svg) => ({
      svg: svg.getBoundingClientRect().width,
      viewport: svg.parentElement?.getBoundingClientRect().width ?? 0,
      scroll: svg.parentElement?.scrollWidth ?? 0,
    }))
    expect(timelineWidth.svg).toBeGreaterThanOrEqual(timelineWidth.viewport - 1)
    expect(timelineWidth.scroll).toBeLessThanOrEqual(timelineWidth.viewport + 1)
  }
  await expect(page.getByRole("button", { name: /Trimestre 1 Clôturée/ })).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("button", { name: /Trimestre 3 Saisie des notes/ })).toHaveAttribute("aria-expanded", "true")
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByText(/Faites défiler la frise horizontalement/)).toBeVisible()
  }
})
