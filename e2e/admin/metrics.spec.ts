import { expect, test, type Page, type Route } from "@playwright/test"

type TenantPlan = "essential" | "pro" | "establishment"

type SchoolListItem = {
  tenantId: string
  name: string
  plan: TenantPlan
  status: "trial" | "active" | "suspended" | "cancelled"
  nbUsers: number
  lastConnection: string | null
  mrrFcfa: number
}

const ADMIN_IDENTIFIER = process.env.E2E_ADMIN_IDENTIFIER ?? "admin@edutrack.ci"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!"
const ADMIN_SCHEMA = process.env.E2E_ADMIN_SCHEMA_NAME ?? "public"

const nowIso = new Date().toISOString()

const schoolsFixture = (): SchoolListItem[] => [
  {
    tenantId: "tenant-1",
    name: "Collège Horizon",
    plan: "pro",
    status: "active",
    nbUsers: 24,
    lastConnection: nowIso,
    mrrFcfa: 76000,
  },
  {
    tenantId: "tenant-2",
    name: "École Liberté",
    plan: "essential",
    status: "trial",
    nbUsers: 9,
    lastConnection: nowIso,
    mrrFcfa: 38000,
  },
  {
    tenantId: "tenant-3",
    name: "Institution République",
    plan: "pro",
    status: "active",
    nbUsers: 31,
    lastConnection: nowIso,
    mrrFcfa: 98000,
  },
]

const json = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

const setupAdminMocks = async (page: Page, schools: SchoolListItem[]) => {
  await page.route("**/api/v1/auth/login/teacher", async (route) => {
    await json(route, {
      accessToken: "admin-token",
      user: {
        id: "admin-user",
        name: "Super Admin",
        role: "super_admin",
        phone: "+2250700000000",
        email: "admin@edutrack.ci",
      },
    })
  })

  await page.route("**/api/v1/admin/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url

    if (request.method() === "GET" && pathname.endsWith("/admin/schools")) {
      await json(route, {
        schools,
        pagination: {
          page: 1,
          limit: 25,
          total: schools.length,
          totalPages: 1,
        },
      })
      return
    }

    if (request.method() === "GET" && pathname.endsWith("/admin/metrics")) {
      await json(route, {
        totalSchools: schools.length,
        activeSchools: schools.filter((school) => school.status === "active").length,
        mrrTotalFcfa: schools.reduce((sum, school) => sum + school.mrrFcfa, 0),
        dauLast7d: [
          { date: "2026-04-10", uniqueUsers: 21 },
          { date: "2026-04-11", uniqueUsers: 24 },
          { date: "2026-04-12", uniqueUsers: 23 },
        ],
        schoolsByPlan: [
          { plan: "essential", count: schools.filter((school) => school.plan === "essential").length },
          { plan: "pro", count: schools.filter((school) => school.plan === "pro").length },
          { plan: "establishment", count: schools.filter((school) => school.plan === "establishment").length },
        ],
      })
      return
    }

    if (request.method() === "GET" && pathname.endsWith("/admin/metrics/revenue")) {
      await json(route, [
        { month: "2026-01", mrr_fcfa: 120000, payments_count: 4 },
        { month: "2026-02", mrr_fcfa: 132000, payments_count: 4 },
        { month: "2026-03", mrr_fcfa: 155000, payments_count: 5 },
      ])
      return
    }

    await route.fallback()
  })
}

const loginAsAdminUI = async (page: Page) => {
  await page.goto("/login")
  await page.getByLabel("Identifiant").fill(ADMIN_IDENTIFIER)
  await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD)
  await page.getByLabel("Schéma tenant").fill(ADMIN_SCHEMA)
  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole("heading", { name: "Console EduTrack" })).toBeVisible()
}

test.describe("Console Super Admin - Métriques", () => {
  test.beforeEach(async ({ page }) => {
    const schools = schoolsFixture()
    await setupAdminMocks(page, schools)
    await loginAsAdminUI(page)
  })

  test("les 4 StatCards se chargent sans erreur", async ({ page }) => {
    await expect(page.getByText("Total écoles actives")).toBeVisible()
    await expect(page.getByText("MRR total FCFA")).toBeVisible()
    await expect(page.getByText("DAU (7j)")).toBeVisible()
    await expect(page.getByText("Taux de rétention")).toBeVisible()
  })

  test("le RevenueChart s'affiche avec des données", async ({ page }) => {
    await expect(page.getByText("MRR sur 12 mois")).toBeVisible()
    await expect(page.locator(".recharts-responsive-container")).toBeVisible()
    await expect(page.locator(".recharts-area path").first()).toBeVisible()
  })

  test("le filtre par plan filtre la liste des écoles", async ({ page }) => {
    const planSelectTrigger = page.getByText("Plan").first().locator("..").getByRole("combobox")
    await planSelectTrigger.click()
    await page.getByRole("option", { name: "pro", exact: true }).click()

    const planBadges = page.locator("tbody tr td:nth-child(2)")
    const plans = await planBadges.allTextContents()

    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) {
      expect(plan.trim().toLowerCase()).toBe("pro")
    }
  })
})
