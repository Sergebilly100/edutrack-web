import { expect, test, type Page } from "@playwright/test"
import { mockDirectorAuth } from "./helpers"

type State = {
  schoolInfoComplete: boolean; activeYear: boolean; levels: boolean; subjects: boolean
  rooms: boolean; fees: boolean; teachers: boolean
}
const ready: State = { schoolInfoComplete: true, activeYear: true, levels: true, subjects: true, rooms: true, fees: true, teachers: false }
async function mockSchool(page: Page, state: State = { ...ready }, identity = { id: "school-a" }) {
  await mockDirectorAuth(page)
  await page.route("**/api/v1/auth/refresh*", async (route) => {
    const claims = Buffer.from(JSON.stringify({ schemaName: identity.id.replaceAll("-", "_") })).toString("base64url")
    await route.fulfill({ json: { accessToken: `header.${claims}.signature` } })
  })
  await page.route("**/api/v1/auth/me*", async (route) => {
    await route.fulfill({ json: { user: { id: `director-${identity.id}`, role: "director", name: "Directeur C6", mustChangePassword: false }, tenant: { id: identity.id, status: "active", trialEndsAt: null } } })
  })
  await page.route("**/api/v1/permissions/me*", async (route) => {
    await route.fulfill({ json: { permissions: ["settings.school", "settings.positions", "classes.view", "classes.create", "classes.edit", "school_years.view", "rooms.view", "rooms.create", "tuition.view", "tuition.edit", "import.teachers", "import.students", "import.schedule", "payments.view", "subscription_plans.view"] } })
  })
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (/\/auth\/|\/permissions\/me|\/school\//.test(path)) return route.fallback()
    // Existing configuration destinations, no live school data needed.
    const bodies: Record<string, unknown> = {
      "/api/v1/levels": { levels: [] }, "/api/v1/subjects": { subjects: [] },
      "/api/v1/classes": { classes: [] }, "/api/v1/rooms": { rooms: [] },
      "/api/v1/school-years": { schoolYears: [{ id: "year-a", label: "09/2026 - 06/2027", status: "active" }] },
      "/api/v1/tuition-plans": { tuitionPlans: [] },
      "/api/v1/permissions/config": { school: { id: identity.id, name: "École A", address: "Abidjan", teachingType: "secondaire" }, positions: [], users: [] },
      "/api/v1/subscriptions/feature-settings": { is_enabled: false, monetize_parent_alerts: false },
      "/api/v1/import/context": { initialConfiguration: true, canImportProfiles: true },
      "/api/v1/import/history": { items: [], total: 0, totalPages: 1 },
    }
    if (path === "/api/v1/levels" && route.request().method() === "POST") {
      state.levels = true
      return route.fulfill({ status: 201, json: { level: { id: "level-c6", ...route.request().postDataJSON() } } })
    }
    return route.fulfill({ json: bodies[path] ?? {} })
  })
  await page.route("**/api/v1/school/info*", async (route) => {
    if (route.request().method() === "PATCH") state.schoolInfoComplete = true
    await route.fulfill({ json: { id: identity.id, name: "École C6", address: "Abidjan", phone: "2250700001111", onboarding_completed: false } })
  })
  await page.route("**/api/v1/school/onboarding-status*", async (route) => {
    const missing = Object.entries(state).filter(([key, value]) => key !== "teachers" && !value).map(([key]) => key)
    await route.fulfill({ json: { ...state, schoolId: identity.id, missing, canComplete: missing.length === 0 } })
  })
}

test("sans année active, le directeur ne peut ni ouvrir l’année ni terminer", async ({ page }) => {
  await mockSchool(page, { ...ready, activeYear: false, fees: false })
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto("/onboarding?step=5&school=school-a")
  await expect(page.getByText(/Le super administrateur doit d’abord ouvrir l’année scolaire/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Accéder au tableau de bord" })).toBeDisabled()
  await expect(page.getByRole("button", { name: /Ouvrir.*année|Créer.*année/ })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: ".tmp/c6-sans-annee-mobile.png", fullPage: true })
})

test("parcours directeur : infos, création d’un niveau, retour et finalisation sans professeur", async ({ page }) => {
  const state = { ...ready, schoolInfoComplete: false, levels: false }
  await mockSchool(page, state)
  let completed = false
  await page.route("**/api/v1/school/onboarding-complete*", async (route) => {
    expect(route.request().method()).toBe("PATCH")
    completed = true
    await route.fulfill({ json: { success: true } })
  })
  await page.goto("/onboarding")
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click()
  await page.getByRole("link", { name: "Configurer les niveaux" }).click()
  await expect(page).toHaveURL(/\/academic\/levels\?returnTo=/)
  await page.getByRole("button", { name: "Ajouter un niveau" }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nom du niveau").fill("6ème")
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole("link", { name: "Retour à la configuration initiale" }).click()
  await expect(page.getByRole("heading", { name: "Référentiel scolaire" })).toBeVisible()
  await expect(page.getByRole("listitem").filter({ hasText: "Au moins un niveau" }).getByText("Prêt")).toBeVisible()
  await page.getByRole("button", { name: "Continuer", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Salles et frais" })).toBeVisible()
  await page.getByRole("button", { name: "Continuer", exact: true }).click()
  await expect(page.getByText(/Facultatif : vous pouvez continuer/)).toBeVisible()
  await expect(page.getByRole("button", { name: /Ajouter le professeur|Ajouter l’élève|Ajouter un créneau/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Continuer sans import" }).click()
  await expect(page.getByText(/Désignez le professeur principal/)).toBeVisible()
  await page.screenshot({ path: ".tmp/c6-finalisation-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Accéder au tableau de bord" }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  expect(completed).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem("onboarding_progress:v2:school-a"))).toBeNull()
})

for (const [step, link, heading] of [
  [2, "Configurer les matières", "Référentiel scolaire"],
  [3, "Configurer les salles", "Salles et frais"],
  [3, "Configurer les frais", "Salles et frais"],
  [4, "Importer les profils et contrats", "Profils à préparer"],
] as const) {
  test(`aller-retour : ${link}`, async ({ page }) => {
    await mockSchool(page)
    await page.goto(`/onboarding?step=${step}&school=school-a`)
    await page.getByRole("link", { name: link }).click()
    if (link === "Importer les profils et contrats") {
      await expect(page.getByRole("tab", { name: /Professeurs/ })).toBeVisible()
      await expect(page.getByRole("tab", { name: /Emploi du temps|Élèves/ })).toHaveCount(0)
    }
    if (link === "Configurer les frais") await expect(page.getByRole("tab", { name: "Finance", exact: true })).toHaveAttribute("data-state", "active")
    await page.getByRole("link", { name: "Retour à la configuration initiale" }).click()
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
    await expect(page.getByRole("list", { name: "Prérequis de configuration" })).toBeVisible()
  })
}

test("deux écoles dans le même navigateur gardent des progressions distinctes", async ({ page }) => {
  const identity = { id: "school-a" }
  await mockSchool(page, { ...ready }, identity)
  await page.addInitScript(() => localStorage.setItem("onboarding_progress", JSON.stringify({ step: 5, schoolInfo: { name: "Ancienne école" } })))
  await page.goto("/onboarding")
  await expect(page.getByRole("heading", { name: /Informations de l.école/ })).toBeVisible()
  await page.getByRole("button", { name: "3. Salles et frais" }).click()
  identity.id = "school-b"
  await page.goto("/onboarding")
  await expect(page.getByRole("heading", { name: /Informations de l.école/ })).toBeVisible()
  await page.getByRole("button", { name: "2. Référentiel scolaire" }).click()
  identity.id = "school-a"
  await page.goto("/onboarding")
  await expect(page.getByRole("heading", { name: "Salles et frais" })).toBeVisible()
  identity.id = "school-b"
  await page.goto("/onboarding")
  await expect(page.getByRole("heading", { name: "Référentiel scolaire" })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("onboarding_progress"))).toBeNull()
})


test("import professeur réussi : retour à l’étape 4 et relecture des profils", async ({ page }) => {
  const state = { ...ready }
  await mockSchool(page, state)
  await page.route("**/api/v1/import/teachers/dry-run*", async (route) => {
    await route.fulfill({ json: { valid: 1, errors: [], preview: [{ "Nom*": "Yao", "Prénom*": "Koffi", "Type*": "vacataire" }], toAdd: [{ key: "yao", displayName: "Koffi Yao" }], toUpdate: [], toDelete: [], unchanged: 0, importMode: "merge", conflicts: [] } })
  })
  await page.route("**/api/v1/import/teachers/confirm*", async (route) => {
    state.teachers = true
    await route.fulfill({ json: { imported: 1, updated: 0, errors: [], preview: [], deactivated: 0, importMode: "merge", parentAccountsCreated: 0, parentAccountsReused: 0, pendingParentAccess: [] } })
  })
  await page.goto("/onboarding?step=4&school=school-a")
  await page.getByRole("link", { name: "Importer les profils et contrats" }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: "profils.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("mock workbook") })
  await page.getByRole("button", { name: "Suivant →" }).click()
  await page.getByRole("button", { name: "Importer →" }).click()
  await expect(page.getByText(/1 enregistrements importés/).first()).toBeVisible()
  await page.getByRole("link", { name: "Retour à la configuration initiale" }).click()
  await expect(page.getByRole("heading", { name: "Profils à préparer", exact: true })).toBeVisible()
  await expect(page.getByText("Profils disponibles", { exact: true })).toBeVisible()
})

test("C7 : historique avec année, ancienne classe et parents à 360px, puis autre lot", async ({ page }) => {
  await mockSchool(page)
  await page.setViewportSize({ width: 360, height: 640 })
  let savedFields: unknown[] | null = null
  let confirmed = false
  const fields = ["matricule", "nom", "prenom", "historical_class", "birth_date", "parent_name", "parent_phone", "parent_email", "parent_name_2", "parent_phone_2"].map((targetField) => ({
    targetField, sourceColumnLabel: targetField, isRequired: targetField === "nom" || targetField === "prenom", translations: [],
  }))
  await page.route("**/api/v1/import/historical-students/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/profile")) {
      savedFields = route.request().postDataJSON().fields
      expect(savedFields).toEqual(fields)
      return route.fulfill({ json: { profile: { fields: savedFields } } })
    }
    if (path.endsWith("/confirm")) {
      confirmed = true
      expect(route.request().postData()).toContain("2024-2025")
      return route.fulfill({ json: { schoolYearLabel: "2024-2025", createdCount: 1, reusedCount: 0, totalRows: 2, errors: [{ rowNumber: 3, field: "nom", reason: "Nom requis" }] } })
    }
    return route.fulfill({ json: {
      schoolYearLabel: "2024-2025", mappingSaved: Boolean(savedFields), headers: fields.map((field) => field.sourceColumnLabel), rowCount: 2, validCount: 1,
      profile: savedFields ? { fields: savedFields } : null, matchedFields: fields, missingTargets: [],
      sampleRows: [{ rowNumber: 2, values: { matricule: "C7-MOBILE", nom: "Test", prenom: "Historique", historical_class: "4e A", parent_name: "Parent mobile A", parent_phone: "2250700000000", parent_email: "parent@example.ci", parent_name_2: "Parent mobile B", parent_phone_2: "2250100000000" } }],
      errors: [{ rowNumber: 3, field: "nom", reason: "Nom requis" }],
    } })
  })
  await page.goto("/onboarding?step=4&school=school-a")
  await page.getByRole("link", { name: "Importer les profils élèves historiques" }).click()
  await expect(page.getByRole("heading", { name: "Profils élèves historiques" })).toBeVisible()
  await expect(page.getByRole("tab")).toHaveCount(0)
  await expect(page.getByText("Mode de mise à jour")).toHaveCount(0)
  await page.getByLabel("Année scolaire de l’historique *").fill("2024-2025")
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['mock workbook'], 'historique.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    return data
  })
  await page.getByRole("region", { name: "Fichier Excel des élèves" }).dispatchEvent("drop", { dataTransfer: transfer })
  await transfer.dispose()
  await expect(page.getByText("historique.xlsx", { exact: true })).toBeVisible()
  await page.screenshot({ path: ".tmp/c7-historical-file-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Analyser les colonnes" }).click()
  await page.getByRole("button", { name: "Vérifier les correspondances" }).click()
  await expect(page.getByRole("combobox")).toHaveCount(10)
  await expect(page.getByRole("combobox", { name: /Ancienne classe/ })).toHaveCount(1)
  await page.getByRole("button", { name: "Enregistrer les correspondances" }).click()
  await expect(page.getByRole("cell", { name: "Nom requis", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: ".tmp/c7-historical-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Importer les profils valides" }).click()
  await expect(page.getByText(/1 profil\(s\) créé\(s\), 0 profil\(s\) déjà présent/)).toBeVisible()
  expect(confirmed).toBe(true)
  await page.getByRole("button", { name: "Importer un autre lot" }).click()
  await expect(page.getByLabel("Année scolaire de l’historique *")).toHaveValue("2024-2025")
  await expect(page.getByRole("button", { name: "Analyser les colonnes" })).toBeDisabled()
  await page.getByRole("link", { name: "Retour à la configuration initiale" }).click()
  await expect(page.getByRole("heading", { name: "Profils à préparer", exact: true })).toBeVisible()
})


test("C7 : les imports de profils restent fermés sur la page normale après finalisation", async ({ page }) => {
  await mockSchool(page)
  await page.route("**/api/v1/import/context*", (route) => route.fulfill({ json: { initialConfiguration: false, canImportProfiles: false } }))
  await page.goto("/import?type=students")
  await expect(page.getByRole("tab", { name: /Emploi du temps/ })).toBeVisible()
  await expect(page.getByRole("tab", { name: /Élèves|Professeurs/ })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Profils élèves historiques" })).toHaveCount(0)
  await expect(page.getByText(/Importez l’emploi du temps et consultez les opérations déjà effectuées/)).toBeVisible()
})
