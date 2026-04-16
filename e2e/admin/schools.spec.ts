import { expect, test, type Page, type Route } from "@playwright/test"

type TenantPlan = "essential" | "pro" | "establishment"
type TenantStatus = "trial" | "active" | "suspended" | "cancelled"

type SchoolListItem = {
  tenantId: string
  name: string
  plan: TenantPlan
  status: TenantStatus
  nbUsers: number
  lastConnection: string | null
  mrrFcfa: number
}

type SchoolState = {
  schools: SchoolListItem[]
  detailsById: Record<string, {
    tenantId: string
    metadata: {
      name: string
      subdomain: string
      schemaName: string
      plan: TenantPlan
      status: TenantStatus
      city: string | null
      teachingType: "primaire" | "secondaire" | "superieur" | "mixte" | null
      maxAdminPositions: number
      createdAt: string
      updatedAt: string
    }
    usageStats: {
      nbUsers: number
      activeUsers7d: number
      teachersCount: number
      studentsCount: number
      attendanceRecords30d: number
      mrrFcfa: number
      lastConnection: string | null
    }
    connectionHistory30d: Array<{ date: string; uniqueUsers: number }>
  }>
}

const ADMIN_IDENTIFIER = process.env.E2E_ADMIN_IDENTIFIER ?? "admin@edutrack.ci"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!"
const ADMIN_SCHEMA = process.env.E2E_ADMIN_SCHEMA_NAME ?? "public"

const nowIso = new Date().toISOString()

const initialSchools = (): SchoolState => {
  const schoolA: SchoolListItem = {
    tenantId: "tenant-a",
    name: "Collège Sainte Marie",
    plan: "essential",
    status: "active",
    nbUsers: 18,
    lastConnection: nowIso,
    mrrFcfa: 45000,
  }
  const schoolB: SchoolListItem = {
    tenantId: "tenant-b",
    name: "Lycée Moderne Cocody",
    plan: "pro",
    status: "trial",
    nbUsers: 11,
    lastConnection: nowIso,
    mrrFcfa: 75000,
  }

  const makeDetail = (school: SchoolListItem) => ({
    tenantId: school.tenantId,
    metadata: {
      name: school.name,
      subdomain: school.name.toLowerCase().replace(/\s+/g, "-"),
      schemaName: `school_${school.tenantId}`,
      plan: school.plan,
      status: school.status,
      city: "Abidjan",
      teachingType: "secondaire" as const,
      maxAdminPositions: 5,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    usageStats: {
      nbUsers: school.nbUsers,
      activeUsers7d: Math.min(school.nbUsers, 9),
      teachersCount: 7,
      studentsCount: 120,
      attendanceRecords30d: 210,
      mrrFcfa: school.mrrFcfa,
      lastConnection: school.lastConnection,
    },
    connectionHistory30d: [
      { date: "2026-04-01", uniqueUsers: 9 },
      { date: "2026-04-02", uniqueUsers: 11 },
      { date: "2026-04-03", uniqueUsers: 10 },
    ],
  })

  return {
    schools: [schoolA, schoolB],
    detailsById: {
      [schoolA.tenantId]: makeDetail(schoolA),
      [schoolB.tenantId]: makeDetail(schoolB),
    },
  }
}

const json = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

const setupAdminMocks = async (page: Page, state: SchoolState) => {
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

    if (request.method() === "GET" && pathname.endsWith("/admin/metrics")) {
      await json(route, {
        totalSchools: state.schools.length,
        activeSchools: state.schools.filter((school) => school.status === "active").length,
        mrrTotalFcfa: state.schools.reduce((sum, school) => sum + school.mrrFcfa, 0),
        dauLast7d: [
          { date: "2026-04-10", uniqueUsers: 17 },
          { date: "2026-04-11", uniqueUsers: 19 },
          { date: "2026-04-12", uniqueUsers: 20 },
        ],
        schoolsByPlan: [
          { plan: "essential", count: state.schools.filter((school) => school.plan === "essential").length },
          { plan: "pro", count: state.schools.filter((school) => school.plan === "pro").length },
          { plan: "establishment", count: state.schools.filter((school) => school.plan === "establishment").length },
        ],
      })
      return
    }

    if (request.method() === "GET" && pathname.endsWith("/admin/metrics/revenue")) {
      await json(route, [
        { month: "2026-01", mrr_fcfa: 120000, payments_count: 2 },
        { month: "2026-02", mrr_fcfa: 140000, payments_count: 2 },
        { month: "2026-03", mrr_fcfa: 155000, payments_count: 3 },
      ])
      return
    }

    if (request.method() === "GET" && pathname.endsWith("/admin/schools")) {
      await json(route, {
        schools: state.schools,
        pagination: {
          page: 1,
          limit: 25,
          total: state.schools.length,
          totalPages: 1,
        },
      })
      return
    }

    if (request.method() === "POST" && pathname.endsWith("/admin/schools")) {
      const payload = request.postDataJSON() as {
        name: string
        subdomain: string
        city: string
        plan: TenantPlan
        teaching_type: "primaire" | "secondaire" | "superieur" | "mixte"
        max_admin_positions: number
        director_name: string
        director_phone: string
      }

      const tenantId = `tenant-${Date.now()}`
      const newSchool: SchoolListItem = {
        tenantId,
        name: payload.name,
        plan: payload.plan,
        status: "trial",
        nbUsers: 1,
        lastConnection: nowIso,
        mrrFcfa: payload.plan === "essential" ? 35000 : payload.plan === "pro" ? 65000 : 120000,
      }

      state.schools = [newSchool, ...state.schools]
      state.detailsById[tenantId] = {
        tenantId,
        metadata: {
          name: payload.name,
          subdomain: payload.subdomain,
          schemaName: `school_${payload.subdomain}`,
          plan: payload.plan,
          status: "trial",
          city: payload.city,
          teachingType: payload.teaching_type,
          maxAdminPositions: payload.max_admin_positions,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        usageStats: {
          nbUsers: 1,
          activeUsers7d: 1,
          teachersCount: 0,
          studentsCount: 0,
          attendanceRecords30d: 0,
          mrrFcfa: newSchool.mrrFcfa,
          lastConnection: nowIso,
        },
        connectionHistory30d: [{ date: "2026-04-12", uniqueUsers: 1 }],
      }

      await json(route, {
        tenantId,
        schoolSchemaName: `school_${payload.subdomain}`,
        directorCredentials: {
          userId: "director-created",
          name: payload.director_name,
          phone: payload.director_phone,
          email: null,
          password: "TempPass123!",
        },
      })
      return
    }

    const detailMatch = pathname.match(/\/api\/v1\/admin\/schools\/([^/]+)$/)
    if (request.method() === "GET" && detailMatch) {
      const tenantId = detailMatch[1] as string
      const detail = state.detailsById[tenantId]
      await json(route, detail, detail ? 200 : 404)
      return
    }

    const configMatch = pathname.match(/\/api\/v1\/admin\/schools\/([^/]+)\/config$/)
    if (request.method() === "PATCH" && configMatch) {
      const tenantId = configMatch[1] as string
      const payload = request.postDataJSON() as {
        plan?: TenantPlan
        status?: TenantStatus
        max_admin_positions?: number
      }

      const targetSchool = state.schools.find((school) => school.tenantId === tenantId)
      const targetDetail = state.detailsById[tenantId]

      if (targetSchool && payload.plan) {
        targetSchool.plan = payload.plan
      }
      if (targetSchool && payload.status) {
        targetSchool.status = payload.status
      }
      if (targetDetail && payload.plan) {
        targetDetail.metadata.plan = payload.plan
      }
      if (targetDetail && payload.status) {
        targetDetail.metadata.status = payload.status
      }
      if (targetDetail && typeof payload.max_admin_positions === "number") {
        targetDetail.metadata.maxAdminPositions = payload.max_admin_positions
      }

      await json(route, { success: true })
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

const createSchoolThroughModal = async (page: Page, input?: { plan?: TenantPlan }) => {
  const uniq = Date.now()
  const schoolName = `E2E Admin School ${uniq}`
  const subdomain = `e2e-admin-${uniq}`
  const phone = `22507${String(uniq).slice(-8)}`
  const directorName = `Directeur E2E ${uniq}`

  await page.getByRole("button", { name: "Créer une école" }).click()
  const dialog = page.getByRole("dialog", { name: "Nouvelle école" })

  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Nom", { exact: true }).fill(schoolName)
  await dialog.getByLabel("Sous-domaine").fill(subdomain)
  await dialog.getByLabel("Ville").fill("Abidjan")

  await dialog.getByRole("combobox").nth(0).click()
  await page.getByRole("option", { name: "Secondaire" }).click()

  await dialog.getByLabel("Nom complet").fill(directorName)
  await dialog.getByLabel("Téléphone").fill(phone)
  await dialog.getByLabel("Email (optionnel)").fill(`directeur.${uniq}@edutrack.ci`)

  if (input?.plan) {
    await dialog.getByRole("combobox").nth(1).click()
    const planLabel = input.plan === "essential" ? "Essential" : input.plan === "pro" ? "Pro" : "Establishment"
    await page.getByRole("option", { name: planLabel }).click()
  }

  await dialog.getByRole("button", { name: "Créer l'école" }).click()

  return { schoolName, directorName, phone }
}

test.describe("Console Super Admin - Écoles", () => {
  test.beforeEach(async ({ page }) => {
    const state = initialSchools()
    await setupAdminMocks(page, state)
    await loginAsAdminUI(page)
  })

  test("la liste des écoles se charge", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "École" })).toBeVisible()
    await expect(page.locator("tbody tr").first()).toBeVisible()
  })

  test("la création d'une école via le modal fonctionne", async ({ page }) => {
    const { schoolName } = await createSchoolThroughModal(page, { plan: "pro" })

    await expect(page.getByText("École créée", { exact: true }).first()).toBeVisible()
    await expect(page.locator("tbody tr").first()).toContainText(schoolName)
  })

  test("les credentials directeur sont affichés après création", async ({ page }) => {
    const { directorName, phone } = await createSchoolThroughModal(page)

    await expect(page.getByText("Identifiants directeur")).toBeVisible()
    await expect(page.getByText(`Nom: ${directorName}`)).toBeVisible()
    await expect(page.getByText(`Téléphone: ${phone}`)).toBeVisible()
    await expect(page.getByText(/Mot de passe:/)).toBeVisible()
  })

  test("la navigation vers le détail école fonctionne", async ({ page }) => {
    const firstDataRow = page.locator("tbody tr").first()
    await expect(firstDataRow).toBeVisible()

    await firstDataRow.getByRole("button", { name: "Voir détail" }).click({ force: true })

    await expect(page).toHaveURL(/\/admin\/schools\/.+/)
    await expect(page.getByText("Informations école")).toBeVisible()
  })

  test("la modification du plan d'une école est sauvegardée", async ({ page }) => {
    const firstDataRow = page.locator("tbody tr").first()
    await expect(firstDataRow).toBeVisible()

    await firstDataRow.getByRole("button", { name: "Config" }).click({ force: true })
    await expect(page).toHaveURL(/\/admin\/schools\/.+/)

    const planSelect = page.getByText("Plan").locator("..")
    await planSelect.getByRole("combobox").click()
    await page.getByRole("option", { name: "pro", exact: true }).click()

    await page.getByRole("button", { name: "Enregistrer" }).click()

    await expect(page.getByText("Configuration mise à jour", { exact: true }).first()).toBeVisible()
    await expect(planSelect.getByRole("combobox")).toContainText("pro")
  })
})
