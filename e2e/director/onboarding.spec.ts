import { expect, test } from "@playwright/test"

import { mockDirectorAuth } from "./helpers"

// Ces tests vérifient que le wizard d'onboarding s'affiche correctement
// quand l'école n'a pas encore complété la configuration initiale.

// loginAsDirectorUI redirige automatiquement /onboarding → /dashboard.
// On utilise un helper local qui reste sur /onboarding.
const loginAndGoToOnboarding = async (page: import("@playwright/test").Page) => {
  await page.goto("/login")
  await page.waitForURL(/\/(login|dashboard|onboarding)(\/|\?|$)/, { timeout: 15000 })

  if (page.url().includes("/login")) {
    await expect(page.getByLabel("Identifiant")).toBeVisible()
    await page.getByLabel("Identifiant").fill("directeur@sainte-marie.ci")
    await page.getByLabel("Mot de passe").fill("Test1234!")
    const schemaInput = page.getByLabel("Schéma tenant")
    if (await schemaInput.count()) {
      await schemaInput.fill("school_sainte_marie")
    }
    await page.getByRole("button", { name: "Se connecter" }).click()
  }

  await page.waitForURL(/\/(dashboard|onboarding)(\/|\?|$)/, { timeout: 25000 })
  // Si la page a redirigé vers /dashboard, forcer /onboarding
  if (!page.url().includes("/onboarding")) {
    await page.goto("/onboarding")
  }
  await expect(page).toHaveURL(/\/onboarding/)
}

const mockOnboardingApis = async (page: import("@playwright/test").Page) => {
  // Surcharge school/info pour indiquer que l'onboarding n'est pas terminé
  await page.route("**/api/v1/school/info*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        onboarding_completed: false,
        name: "",
        phone: "",
        city: "",
        teaching_type: "secondaire",
      }),
    })
  })

  // Route utilisée à l'étape 1 pour sauvegarder les infos école
  await page.route("**/api/v1/school/info*", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    } else {
      await route.fallback()
    }
  })

  // Route completeOnboarding - PATCH /school/onboarding-complete
  await page.route("**/api/v1/school/onboarding-complete*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })

  // Profs (étape 2)
  await page.route("**/api/v1/teachers*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { page: 1, limit: 200, total: 0, totalPages: 0 } }),
      })
    } else {
      await route.fallback()
    }
  })

  // Élèves (étape 3)
  await page.route("**/api/v1/students*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
      })
    } else {
      await route.fallback()
    }
  })

  // EDT (étape 4)
  await page.route("**/api/v1/schedule/weekly*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ date: "2026-06-06", period: null, schedules: [], teachers: [], classes: [], rooms: [], time_slots: [] }),
    })
  })
}

test.describe("Onboarding wizard - directeur", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
    await mockOnboardingApis(page)
  })

  test("affiche le wizard avec le titre 'Onboarding directeur'", async ({ page }) => {
    await loginAndGoToOnboarding(page)
    // loginAsDirectorUI navigue vers /onboarding quand onboarding_completed = false
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByText("Onboarding directeur")).toBeVisible({ timeout: 10000 })
  })

  test("l'étape 1 affiche 'Étape 1 - Infos école'", async ({ page }) => {
    await loginAndGoToOnboarding(page)
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByRole("heading", { name: /étape 1.*infos école/i })).toBeVisible({ timeout: 10000 })
  })

  test("5 badges d'étapes sont visibles dans le wizard", async ({ page }) => {
    await loginAndGoToOnboarding(page)
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByText("Onboarding directeur")).toBeVisible({ timeout: 10000 })

    // Les badges s'affichent sous la forme "N. Label" - on vérifie le texte "Étape N/5" dans le sous-titre
    await expect(page.getByText(/étape 1\/5/i)).toBeVisible({ timeout: 10000 })

    // Vérifier les labels de badges via regex partielle
    await expect(page.getByText(/infos école/i).first()).toBeVisible()
    await expect(page.getByText(/profs/i).first()).toBeVisible()
    await expect(page.getByText(/emploi du temps/i).first()).toBeVisible()
    await expect(page.getByText(/test live/i).first()).toBeVisible()
  })

  test("l'étape 1 montre le bouton 'Continuer'", async ({ page }) => {
    await loginAndGoToOnboarding(page)
    await expect(page).toHaveURL(/\/onboarding/)
    await expect(page.getByRole("heading", { name: /étape 1.*infos école/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /continuer/i })).toBeVisible()
  })
})

test("F35 : parcourt les cinq étapes et conserve la progression après rechargement", async ({ page }) => {
  await mockDirectorAuth(page)
  await mockOnboardingApis(page)
  let completed = false
  let school: Record<string, unknown> = { name: "", phone: "", address: "" }
  let teacher: Record<string, unknown> | null = null
  await page.route("**/api/v1/school/info*", async (route) => {
    if (route.request().method() === "PATCH") school = route.request().postDataJSON()
    await route.fulfill({ json: { ...school, onboarding_completed: completed, teaching_type: "secondaire" } })
  })
  await page.route("**/api/v1/teachers*", async (route) => {
    if (route.request().method() === "POST") {
      teacher = { id: "teacher-onboarding-qa", ...route.request().postDataJSON() }
      await route.fulfill({ status: 201, json: teacher })
    } else {
      await route.fulfill({ json: teacher ? [teacher] : [] })
    }
  })
  await page.route("**/api/v1/school/onboarding-complete*", async (route) => {
    expect(route.request().method()).toBe("PATCH")
    completed = true
    await route.fulfill({ json: { success: true } })
  })
  await loginAndGoToOnboarding(page)
  await page.getByLabel("Nom de l'école").fill("École configuration QA")
  await page.getByLabel("Téléphone", { exact: true }).fill("2250700001122")
  await page.getByLabel("Adresse", { exact: true }).fill("Abidjan")
  await page.getByRole("button", { name: "Continuer", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Étape 2 - Professeurs" })).toBeVisible()
  expect(school).toEqual({ name: "École configuration QA", phone: "2250700001122", address: "Abidjan" })
  await expect(page.getByRole("button", { name: "Continuer", exact: true })).toBeDisabled()
  await page.getByPlaceholder("Nom du prof").fill("Professeur QA")
  await page.getByPlaceholder("Matière", { exact: true }).fill("Mathématiques")
  await page.getByRole("button", { name: "Ajouter le professeur" }).click()
  await expect(page.getByText("1 professeur(s)", { exact: true })).toBeVisible()
  expect(teacher).toMatchObject({ name: "Professeur QA", subjects: ["Mathématiques"], type: "vacataire" })
  await page.reload()
  await expect(page.getByRole("heading", { name: "Étape 2 - Professeurs" })).toBeVisible()
  await page.getByRole("button", { name: "Continuer", exact: true }).click()
  await expect(page.getByRole("heading", { name: /Étape 3/ })).toBeVisible()
  await page.getByRole("button", { name: "Passer cette étape", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Étape 4 - Emploi du temps" })).toBeVisible()
  await page.getByRole("button", { name: "Continuer", exact: true }).click()
  await expect(page.getByRole("heading", { name: /Configuration terminée/ })).toBeVisible()
  await page.getByRole("button", { name: "Accéder au tableau de bord" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(completed).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem("onboarding_progress"))).toBeNull()
})
