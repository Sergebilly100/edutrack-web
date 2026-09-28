import { expect, test, type Page } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const api = () => process.env.E2E_API_URL!
const password = "ParentC16!2026"
const phones = {
  active: "2250000008841",
  near: "2250000008842",
  absent: "2250000008843",
} as const

test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ mode: "serial" })

async function login(page: Page, state: keyof typeof phones) {
  await returningUser(page)
  await page.goto("/parent/login")
  await page.getByLabel("Numéro de téléphone").fill(phones[state])
  await page.getByLabel("Mot de passe", { exact: true }).fill(password)
  const response = page.waitForResponse((result) => result.url().endsWith("/auth/login/parent"))
  await page.getByRole("button", { name: "Se connecter" }).click()
  const loginResponse = await response
  expect(loginResponse.status()).toBe(200)
  await expect(page).toHaveURL(/\/parent\/dashboard$/)
  return (await loginResponse.json()) as { accessToken: string; user: { studentIds: string[] } }
}

test("C16 sans abonnement : carte persistante sur tableau de bord et compte", async ({ page }) => {
  const parent = await login(page, "absent")
  const status = await page.request.get(`${api()}/parent/subscription/status`, {
    headers: { authorization: `Bearer ${parent.accessToken}` },
  })
  expect(status.status()).toBe(200)
  expect(await status.json()).toEqual({
    subscription: null,
    offer: { available: true, unit_price_fcfa: 1000, billing: "per_child_per_month" },
  })
  const card = page.getByText("Alertes d'absence en temps réel")
  await expect(card).toBeVisible()
  await expect(page.getByText(/1\s?000 FCFA par enfant et par mois/)).toBeVisible()
  await expect(page.getByText(/vous ne recevrez pas les alertes d'absence/)).toBeVisible()
  await expect(page.getByText(/Rendez-vous à l'administration de l'école/)).toBeVisible()
  await page.reload()
  await expect(card).toBeVisible()
  await page.getByRole("link", { name: "Compte", exact: true }).click()
  await expect(page).toHaveURL(/\/parent\/account$/)
  await expect(card).toBeVisible()
  await expect(page.getByText(/1\s?000 FCFA par enfant et par mois/)).toBeVisible()
  await page.reload()
  await expect(card).toBeVisible()
})

for (const state of ["active", "near"] as const) {
  test(`C16 ${state} : alertes existantes et accès conservés`, async ({ page }) => {
    const parent = await login(page, state)
    await expect(page.getByText("Alertes d'absence en temps réel")).toHaveCount(0)
    const status = await page.request.get(`${api()}/parent/subscription/status`, {
      headers: { authorization: `Bearer ${parent.accessToken}` },
    })
    expect(status.status()).toBe(200)
    const body = await status.json()
    expect(body.subscription.status).toBe("active")
    expect(body.subscription.days_remaining).toBeLessThanOrEqual(state === "near" ? 5 : 45)
    if (state === "near") {
      await expect(page.getByText("Abonnement bientôt expiré")).toBeVisible()
    } else {
      await expect(page.getByText("Abonnement bientôt expiré")).toHaveCount(0)
    }
    await page.getByRole("link", { name: "Compte", exact: true }).click()
    await expect(page.getByText(/Actif jusqu'au/)).toBeVisible()
    await expect(page.getByText("Alertes d'absence en temps réel")).toHaveCount(0)
    if (state === "near") await expect(page.getByText(/renouveler votre abonnement/)).toBeVisible()
    await page.getByRole("link", { name: "Absences", exact: true }).click()
    await expect(page.getByRole("heading", { name: /Historique des absences/ })).toBeVisible()
  })
}

test("C16 sans offre réelle : aucun montant promis sur les deux écrans", async ({ page }) => {
  const admin = await page.request.post(`${api()}/auth/login/admin`, {
    headers: { "x-tenant-schema": process.env.E2E_SCHEMA_NAME! },
    data: { identifier: process.env.E2E_ADMIN_IDENTIFIER, password: process.env.E2E_ADMIN_PASSWORD },
  })
  expect(admin.status()).toBe(200)
  const headers = { authorization: `Bearer ${(await admin.json()).accessToken}` }
  const schools = await page.request.get(`${api()}/admin/schools`, {
    headers, params: { search: "École QA navigateur" },
  })
  expect(schools.status()).toBe(200)
  const tenantId = (await schools.json()).schools[0].tenantId as string
  const setMonetized = (value: boolean) => page.request.patch(
    `${api()}/admin/schools/${tenantId}/sms-feature/config`,
    { headers, data: { monetizeParentAlerts: value } },
  )
  expect((await setMonetized(false)).status()).toBe(200)
  try {
    await login(page, "absent")
    await expect(page.getByText("Alertes d'absence en temps réel")).toHaveCount(0)
    await expect(page.getByText(/FCFA par enfant et par mois/)).toHaveCount(0)
    await page.getByRole("link", { name: "Compte", exact: true }).click()
    await expect(page.getByText("Alertes d'absence en temps réel")).toHaveCount(0)
    await expect(page.getByText(/FCFA par enfant et par mois/)).toHaveCount(0)
  } finally {
    expect((await setMonetized(true)).status()).toBe(200)
  }
})

test("C16 chargement et erreur réseau du statut sur les deux écrans", async ({ page }) => {
  await login(page, "absent")
  for (const path of ["/parent/dashboard", "/parent/account"]) {
    await page.route("**/parent/subscription/status", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      await route.continue()
    })
    await page.goto(path)
    await expect(page.getByRole("status", { name: "Chargement de l'abonnement…" })).toBeVisible()
    await expect(page.getByText("Alertes d'absence en temps réel")).toBeVisible()
    await page.unrouteAll()

    await page.route("**/parent/subscription/status", (route) => route.abort("failed"))
    await page.reload()
    await expect(page.getByText("Impossible de charger l'abonnement.")).toBeVisible()
    await expect(page.getByText(/FCFA par enfant et par mois/)).toHaveCount(0)
    await page.unrouteAll()
  }
})
