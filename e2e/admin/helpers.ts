import { expect, type APIRequestContext, type Page } from "@playwright/test"

export const ADMIN_IDENTIFIER = process.env.E2E_ADMIN_IDENTIFIER ?? "admin@edutrack.ci"
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234!"
export const ADMIN_SCHEMA = process.env.E2E_ADMIN_SCHEMA_NAME ?? "school_sainte_marie"
const API_BASE_URL = process.env.E2E_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3000/api/v1"

type LoginPayload = {
  accessToken: string
}

type CreateSchoolPayload = {
  name: string
  subdomain: string
  city: string
  teaching_type: "primaire" | "secondaire" | "superieur" | "mixte"
  plan: "essential" | "pro" | "establishment"
  max_admin_positions: number
  director_name: string
  director_phone: string
  director_email?: string
}

type CreateSchoolResponse = {
  tenantId: string
}

export type AdminApiAuth = {
  headers: Record<string, string>
}

export const loginAsAdminUI = async (page: Page) => {
  await page.goto("/login")
  await page.getByLabel("Identifiant").fill(ADMIN_IDENTIFIER)
  await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD)
  await page.getByLabel("Schéma tenant").fill(ADMIN_SCHEMA)
  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole("heading", { name: "Console EduTrack" })).toBeVisible()
}

export const createAdminApiAuth = async (request: APIRequestContext): Promise<AdminApiAuth> => {
  const loginResponse = await request.post(`${API_BASE_URL}/auth/login/teacher`, {
    headers: {
      "x-tenant-schema": ADMIN_SCHEMA,
    },
    data: {
      identifier: ADMIN_IDENTIFIER,
      password: ADMIN_PASSWORD,
    },
  })

  expect(loginResponse.ok(), "Admin API login failed").toBeTruthy()
  const payload = (await loginResponse.json()) as LoginPayload
  expect(typeof payload.accessToken).toBe("string")
  expect(payload.accessToken.length).toBeGreaterThan(0)

  return {
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
    },
  }
}

export const createSchoolViaApi = async (
  request: APIRequestContext,
  auth: AdminApiAuth,
  plan: "essential" | "pro" | "establishment" = "essential"
) => {
  const uniq = Date.now()
  const schoolName = `E2E Admin School ${uniq}`
  const payload: CreateSchoolPayload = {
    name: schoolName,
    subdomain: `e2e-admin-${uniq}`,
    city: "Abidjan",
    teaching_type: "secondaire",
    plan,
    max_admin_positions: 5,
    director_name: `Directeur E2E ${uniq}`,
    director_phone: `22507${String(uniq).slice(-8)}`,
    director_email: `directeur.${uniq}@edutrack.ci`,
  }

  const createResponse = await request.post(`${API_BASE_URL}/admin/schools`, {
    headers: auth.headers,
    data: payload,
  })

  expect(createResponse.ok(), "Create school API failed").toBeTruthy()
  const created = (await createResponse.json()) as CreateSchoolResponse

  return {
    schoolName,
    tenantId: created.tenantId,
  }
}
