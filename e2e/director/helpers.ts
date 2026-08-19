import { expect, type Page, type PlaywrightTestArgs } from "@playwright/test"

export const mockDirectorAuth = async (page: Page) => {
  await page.route("**/api/v1/auth/refresh*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: "director-e2e-token" }),
    })
  })
  await page.route("**/api/v1/auth/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "director-e2e-user",
          role: "director",
          name: "Directeur E2E",
          phone: null,
          email: "directeur@sainte-marie.ci",
          profilePhotoUrl: null,
          mustChangePassword: false,
        },
        tenant: { id: "tenant-e2e", status: "active", trialEndsAt: null },
      }),
    })
  })
  await page.route("**/api/v1/permissions/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        permissions: [
          "teachers.view", "teachers.edit", "teachers.block", "teachers.documents",
          "students.view",
          "schedule.view", "schedule.edit",
          "attendance.view",
          "salary.view", "salary.mark_paid", "salary.export",
          "validations.view",
          "rooms.view", "rooms.create", "rooms.edit", "rooms.delete",
          "import.students", "import.teachers", "import.schedule",
          "settings.school", "settings.positions", "settings.sms_templates",
          "subscriptions.view", "subscriptions.revenue",
          "tuition.view", "tuition.edit", "tuition.grant_discount",
          "payments.view", "payments.record", "payments.cancel",
          "subscription_plans.view", "subscription_plans.edit",
        ],
      }),
    })
  })
  await page.route("**/api/v1/school/info*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ onboarding_completed: true }),
    })
  })
  // Badge validations (sidebar)
  await page.route("**/api/v1/validations/pending/count*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total: 0, gps_suspicious: 0, short_hours: 0, missing_end_scan: 0 }),
    })
  })
}

type LoginPayload = {
  accessToken: string
}

let cachedDirectorAuth: { token: string; expiresAt: number } | null = null

type TeacherListItem = {
  id: string
  isBlocked?: boolean
  is_blocked?: boolean
}

type TeachersResponse = {
  data?: TeacherListItem[]
}

type SalarySummaryItem = {
  teacherType?: string
  status?: string
  salaryRecordId?: string | null
}

type SalarySummaryResponse = {
  items?: SalarySummaryItem[]
}

const DIRECTOR_IDENTIFIER = process.env.E2E_DIRECTOR_IDENTIFIER ?? "directeur@sainte-marie.ci"
const DIRECTOR_PASSWORD = process.env.E2E_DIRECTOR_PASSWORD ?? "Test1234!"
const TENANT_SCHEMA = process.env.E2E_SCHEMA_NAME ?? "school_sainte_marie"
const API_BASE_URL = process.env.E2E_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3000/api/v1"

const toMonthKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

const getMonthOffset = (offset: number): string => {
  const now = new Date()
  const shifted = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offset, 1))
  return toMonthKey(shifted)
}

export const formatMonthLabel = (month: string): string => {
  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return month
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthIndex, 1)))
}

export const loginAsDirectorUI = async (page: Page) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/login")
    await page.waitForURL(/\/(login|dashboard|onboarding)(\/|\?|$)/, { timeout: 15000 })

    if (page.url().includes("/login")) {
      await expect(page.getByLabel("Identifiant")).toBeVisible()
      await page.getByLabel("Identifiant").fill(DIRECTOR_IDENTIFIER)
      await page.getByLabel("Mot de passe").fill(DIRECTOR_PASSWORD)
      const schemaInput = page.getByLabel("Schéma tenant")
      if (await schemaInput.count()) {
        await schemaInput.fill(TENANT_SCHEMA)
      }
      await page.getByRole("button", { name: "Se connecter" }).click()
    }

    try {
      await page.waitForURL(/\/(dashboard|onboarding)(\/|\?|$)/, { timeout: 25000 })
      break
    } catch (error) {
      if (attempt === 1) {
        throw error
      }
    }
  }

  if (page.url().includes("/onboarding")) {
    await page.getByRole("link", { name: "Dashboard" }).first().click()
    await page.waitForURL(/\/dashboard(\/|\?|$)/, { timeout: 10000 })
  }

  await expect(page).toHaveURL(/\/dashboard/)
}

export type DirectorApiAuth = {
  headers: Record<string, string>
}

export const createDirectorApiAuth = async (
  request: PlaywrightTestArgs["request"]
): Promise<DirectorApiAuth> => {
  if (cachedDirectorAuth && Date.now() < cachedDirectorAuth.expiresAt) {
    return {
      headers: {
        Authorization: `Bearer ${cachedDirectorAuth.token}`,
        "x-tenant-schema": TENANT_SCHEMA,
      },
    }
  }

  const loginResponse = await request.post(`${API_BASE_URL}/auth/login/teacher`, {
    headers: {
      "x-tenant-schema": TENANT_SCHEMA,
    },
    data: {
      identifier: DIRECTOR_IDENTIFIER,
      password: DIRECTOR_PASSWORD,
    },
  })

  expect(loginResponse.ok()).toBeTruthy()

  const payload = (await loginResponse.json()) as LoginPayload
  expect(typeof payload.accessToken).toBe("string")
  expect(payload.accessToken.length).toBeGreaterThan(0)
  cachedDirectorAuth = {
    token: payload.accessToken,
    expiresAt: Date.now() + 10 * 60 * 1000,
  }

  return {
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
      "x-tenant-schema": TENANT_SCHEMA,
    },
  }
}

export const findPayableMonth = async (
  request: PlaywrightTestArgs["request"],
  auth: DirectorApiAuth
): Promise<string> => {
  for (let offset = 0; offset < 12; offset += 1) {
    const month = getMonthOffset(offset)

    await request.post(`${API_BASE_URL}/billing/salary/compute`, {
      headers: auth.headers,
      params: { month },
    })

    const summaryResponse = await request.get(`${API_BASE_URL}/billing/salary/summary`, {
      headers: auth.headers,
      params: { month },
    })

    if (!summaryResponse.ok()) {
      continue
    }

    const summaryPayload = (await summaryResponse.json()) as SalarySummaryResponse
    const items = Array.isArray(summaryPayload.items) ? summaryPayload.items : []

    const hasPendingVacataire = items.some(
      (item) => item.teacherType === "vacataire" && item.status === "pending" && typeof item.salaryRecordId === "string"
    )

    if (hasPendingVacataire) {
      return month
    }
  }

  throw new Error("Aucun mois payable trouvé sur les 12 derniers mois")
}

export const getFirstTeacherId = async (
  request: PlaywrightTestArgs["request"],
  auth: DirectorApiAuth
): Promise<string> => {
  const teachersResponse = await request.get(`${API_BASE_URL}/teachers`, {
    headers: auth.headers,
    params: { page: 1, limit: 100 },
  })

  expect(teachersResponse.ok()).toBeTruthy()

  const teachersPayload = (await teachersResponse.json()) as TeachersResponse
  const teachers = Array.isArray(teachersPayload.data) ? teachersPayload.data : []
  const activeTeacher = teachers.find((teacher) => {
    const blocked = teacher.isBlocked ?? teacher.is_blocked ?? false
    return !blocked
  })
  const teacherId = (activeTeacher ?? teachers[0])?.id
  expect(teacherId).toBeTruthy()
  return teacherId as string
}

export const selectSalaryMonth = async (page: Page, month: string) => {
  const monthLabel = formatMonthLabel(month)
  await page.getByTestId("salaries-month-select-trigger").click()
  await page.getByRole("option", { name: monthLabel }).click()
}
