import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test } from "@playwright/test"

const AUTH_DIR = path.resolve(process.cwd(), "e2e/.auth")
const API_BASE_URL = process.env.E2E_API_URL ?? process.env.VITE_API_URL ?? "http://127.0.0.1:3000/api/v1"
const TENANT_SCHEMA = process.env.E2E_SCHEMA_NAME ?? "school_sainte_marie"
const DIRECTOR_IDENTIFIER = process.env.E2E_DIRECTOR_IDENTIFIER ?? "directeur@sainte-marie.ci"
const DIRECTOR_PASSWORD = process.env.E2E_DIRECTOR_PASSWORD ?? "Test1234!"

const PARENT_FULL_NAME = process.env.E2E_PARENT_FULL_NAME ?? "Parent E2E"

const loginDirectorApi = async (request: Parameters<Parameters<typeof test>[1]>[0]["request"]) => {
  const response = await request.post(`${API_BASE_URL}/auth/login/teacher`, {
    headers: { "x-tenant-schema": TENANT_SCHEMA },
    data: {
      identifier: DIRECTOR_IDENTIFIER,
      password: DIRECTOR_PASSWORD,
    },
  })

  expect(response.ok()).toBeTruthy()
  const payload = (await response.json()) as { accessToken: string }
  return payload.accessToken
}

test("setup parent auth state", async ({ page, request }) => {
  await mkdir(AUTH_DIR, { recursive: true })
  const storagePath = path.join(AUTH_DIR, "parent.json")
  await page.route("**/api/v1/school/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name: "E2E School" }),
    })
  })

  const directorToken = await loginDirectorApi(request)

  const studentsResponse = await request.get(`${API_BASE_URL}/students?page=1&limit=10`, {
    headers: {
      Authorization: `Bearer ${directorToken}`,
      "x-tenant-schema": TENANT_SCHEMA,
    },
  })
  expect(studentsResponse.ok()).toBeTruthy()

  const studentsPayload = (await studentsResponse.json()) as {
    data: Array<{ id: string }>
  }
  const firstStudentId = studentsPayload.data[0]?.id
  expect(firstStudentId).toBeTruthy()

  const createResponse = await request.post(`${API_BASE_URL}/subscriptions/parents`, {
    headers: {
      Authorization: `Bearer ${directorToken}`,
      "x-tenant-schema": TENANT_SCHEMA,
    },
    data: {
      full_name: PARENT_FULL_NAME,
      phone: parentPhone,
      student_ids: [firstStudentId],
      duration_months: 1,
      payment_method: "cash",
      paid_now: true,
    },
  })

  if (!createResponse.ok() && createResponse.status() !== 409) {
    throw new Error(`Unable to create parent subscription for e2e setup: ${createResponse.status()}`)
  }

  await page.goto("/parent/login")
  await page.getByLabel("Votre numéro de téléphone").fill(parentPhone)
  await page.getByLabel("Mot de passe").fill(parentPassword)
  await page.getByRole("button", { name: "Se connecter" }).click()
  await page.waitForURL("**/parent/dashboard**")
  await page.evaluate((pwd) => {
    window.localStorage.setItem("e2e_parent_password", pwd)
  }, parentPassword)
  await page.evaluate((phone) => {
    window.localStorage.setItem("e2e_parent_phone", phone)
  }, parentPhone)

  await page.context().storageState({ path: storagePath })
})
  const parentPhone = `22507${Date.now().toString().slice(-8)}`
  const parentPassword = parentPhone.slice(-4)
