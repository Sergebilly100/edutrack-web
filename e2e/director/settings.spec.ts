import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

const mockSettingsApis = async (page: import("@playwright/test").Page) => {
  // fetchSchoolConfig appelle /permissions/config
  await page.route("**/api/v1/permissions/config*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        school: {
          name: "École Sainte-Marie",
          subdomain: "sainte-marie",
          plan: "premium",
          city: "Abidjan",
          teachingType: "secondaire",
          maxUsers: 10,
          currentUsers: 2,
          totalUsers: 2,
          adminUsersCount: 2,
          logoUrl: null,
          activeSchoolYear: "2025-2026",
          canEditSmsTemplate: true,
          allowTeacherQrSkip: false,
        },
        limits: { maxAdminPositions: 5 },
        positions: [],
        users: [],
      }),
    })
  })
  await page.route("**/api/v1/permissions/positions*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ positions: [] }),
    })
  })
  await page.route("**/api/v1/settings/sms-price*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        is_enabled: true,
        monetize_parent_alerts: false,
        commission_pct: 10,
        sms_unit_price_fcfa: 10,
      }),
    })
  })
  await page.route("**/api/v1/notifications/templates*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ template: "Bonjour {{parentName}}, votre élève {{studentName}} est absent." }),
    })
  })
  await page.route("**/api/v1/subscriptions/school-config*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isEnabled: false }),
    })
  })
}

test.describe("Directeur — module paramètres", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectorAuth(page)
    await mockSettingsApis(page)
  })

  test("affiche le titre 'Paramètres école' après navigation via le menu", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click()
    await page.getByRole("link", { name: "Paramètres" }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByText("Paramètres école")).toBeVisible()
  })

  test("affiche la section 'Informations école'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Informations école")).toBeVisible()
  })

  test("affiche la section 'Postes administratifs'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Postes administratifs").first()).toBeVisible()
  })

  test("le directeur voit le bouton 'Nouveau poste'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByRole("button", { name: "Nouveau poste" })).toBeVisible()
  })

  test("ouvre le modal de création de poste en cliquant sur 'Nouveau poste'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("dialog").getByText("Nouveau poste")).toBeVisible()
    await expect(page.getByPlaceholder(/Censeur/i)).toBeVisible()
  })

  test("ferme le modal de création avec le bouton Annuler", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Annuler" }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
  })

  test("empêche la soumission du formulaire si le nom du poste est trop court", async ({ page }) => {
    await page.route("**/api/v1/permissions/positions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Validation error" }),
        })
      } else {
        await route.continue()
      }
    })
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.getByPlaceholder(/Censeur/i).fill("A")
    await page.getByRole("button", { name: "Créer le poste" }).click()

    await expect(page.getByText(/au moins 2 caractères/i)).toBeVisible()
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("le bouton 'Créer le poste' est actif quand le nom est valide", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await page.getByRole("button", { name: "Nouveau poste" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.getByPlaceholder(/Censeur/i).fill("Censeur")
    const submitButton = page.getByRole("button", { name: "Créer le poste" })
    await expect(submitButton).not.toBeDisabled()
  })

  test("affiche la section 'Template SMS absence élève' pour le directeur", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Template SMS absence élève")).toBeVisible()
  })

  test("affiche le badge École dans le centre de configuration", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    // Le badge affiche "École: Accessible" (car permissions settings.school présentes)
    await expect(page.getByText(/^École:/).first()).toBeVisible()
  })

  test("affiche la section 'Utilisateurs administratifs'", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    await expect(page.getByText("Utilisateurs administratifs").first()).toBeVisible()
  })

  test("la page /settings utilise l'animation fade-in du conteneur principal", async ({ page }) => {
    await loginAsDirectorUI(page)
    await page.goto("/settings")
    const mainContainer = page.locator(".animate-fade-in").first()
    await expect(mainContainer).toBeAttached()
  })
})
