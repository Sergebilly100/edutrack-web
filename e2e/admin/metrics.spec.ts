import { expect, test } from "@playwright/test"

import { createAdminApiAuth, createSchoolViaApi, loginAsAdminUI } from "./helpers"

test.describe("Console Super Admin - Métriques", () => {
  test.describe.configure({ mode: "serial" })

  test("les 4 StatCards se chargent sans erreur", async ({ page }) => {
    await loginAsAdminUI(page)
    await expect(page.getByText("Total écoles actives")).toBeVisible()
    await expect(page.getByText("MRR total FCFA")).toBeVisible()
    await expect(page.getByText("DAU (7j)")).toBeVisible()
    await expect(page.getByText("Taux de rétention")).toBeVisible()
  })

  test("le RevenueChart s'affiche avec des données", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    await createSchoolViaApi(request, auth, "pro")

    await loginAsAdminUI(page)

    const revenueResponse = await request.get("http://localhost:3000/api/v1/admin/metrics/revenue", {
      headers: auth.headers,
    })
    expect(revenueResponse.ok()).toBeTruthy()

    const payload = (await revenueResponse.json()) as Array<{ month: string; mrr_fcfa: number }>
    expect(payload.length).toBeGreaterThan(0)

    await expect(page.getByText("MRR sur 12 mois")).toBeVisible()
    await expect(page.locator(".recharts-responsive-container")).toBeVisible()
  })

  test("le filtre par plan filtre la liste des écoles", async ({ page, request }) => {
    const auth = await createAdminApiAuth(request)
    const proSchool = await createSchoolViaApi(request, auth, "pro")
    const essentialSchool = await createSchoolViaApi(request, auth, "essential")

    await loginAsAdminUI(page)

    const planSelectTrigger = page.getByText("Plan", { exact: true }).first().locator("..").getByRole("combobox")
    await planSelectTrigger.click()
    await page.getByRole("option", { name: "pro", exact: true }).click()

    await page.getByPlaceholder("Rechercher une école").fill(proSchool.schoolName)
    await expect(page.getByRole("row", { name: new RegExp(proSchool.schoolName) }).first()).toBeVisible()

    await page.getByPlaceholder("Rechercher une école").fill(essentialSchool.schoolName)
    await expect(page.getByText("Aucune école trouvée avec ces filtres.", { exact: true })).toBeVisible()
  })
})
