import { expect, test } from "@playwright/test"
import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

test("la direction consulte les bulletins publiés d’une classe archivée et son PDF", async ({ page }) => {
  await mockDirectorAuth(page)
  const currentYear = "11111111-1111-4111-8111-111111111111"
  const oldYear = "22222222-2222-4222-8222-222222222222"
  const currentPeriod = "33333333-3333-4333-8333-333333333333"
  const oldPeriod = "44444444-4444-4444-8444-444444444444"
  const currentClass = "55555555-5555-4555-8555-555555555555"
  const oldClass = "66666666-6666-4666-8666-666666666666"
  const cardId = "77777777-7777-4777-8777-777777777777"

  await page.route("**/api/v1/school-years*", (route) => route.fulfill({ json: { schoolYears: [
    { id: currentYear, label: "2026-2027", status: "active" },
    { id: oldYear, label: "2024-2025", status: "closed" },
  ] } }))
  await page.route("**/api/v1/levels*", (route) => route.fulfill({ json: { levels: [
    { id: "level-1", name: "6ème", orderIndex: 1 },
  ] } }))
  await page.route("**/api/v1/grading-periods*", (route) => {
    const yearId = new URL(route.request().url()).searchParams.get("schoolYearId")
    return route.fulfill({ json: { gradingPeriods: yearId === oldYear
      ? [{ id: oldPeriod, schoolYearId: oldYear, label: "Trimestre 3", isClosed: false, hasGeneratedCards: true, bulletinGenerationAvailable: false }]
      : [{ id: currentPeriod, schoolYearId: currentYear, label: "Trimestre 1", isClosed: false, bulletinGenerationAvailable: true }],
    } })
  })
  await page.route("**/api/v1/report-cards/classes*", (route) => {
    const yearId = new URL(route.request().url()).searchParams.get("schoolYearId")
    return route.fulfill({ json: { classes: yearId === oldYear
      ? [{ id: oldClass, name: "6ème Archives", isActive: false, level: { id: "level-1", name: "6ème", orderIndex: 1 } }]
      : [{ id: currentClass, name: "6ème A", isActive: true, level: { id: "level-1", name: "6ème", orderIndex: 1 } }],
    } })
  })
  await page.route(`**/api/v1/report-cards/class/${oldClass}*`, (route) => route.fulfill({ json: { reportCards: [
    { id: cardId, studentName: "Aya Koné", generalAverage: 14.25, rank: 2, status: "published" },
  ] } }))
  await page.route("**/api/v1/report-cards/readiness*", (route) => route.fulfill({ json: { classes: [] } }))
  await page.route("**/api/v1/report-cards/conduct-audit*", (route) => route.fulfill({ json: { periods: [] } }))
  await page.route(`**/api/v1/report-cards/${cardId}/pdf`, (route) => route.fulfill({ status: 202, json: { jobId: "job-c31" } }))
  await page.route("**/api/v1/jobs/job-c31/status", (route) => route.fulfill({ json: {
    jobId: "job-c31", status: "done", downloadUrl: "http://localhost:5173/c31-bulletin.pdf",
  } }))
  await page.route("**/c31-bulletin.pdf", (route) => route.fulfill({ status: 200,
    headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=bulletin.pdf" },
    body: "%PDF-1.4\n%%EOF", 
  }))

  await loginAsDirectorUI(page)
  await page.goto("/academic/report-cards")
  await expect(page.getByRole("combobox", { name: "Année scolaire" })).toContainText("2026-2027")
  await page.getByRole("combobox", { name: "Classe" }).click()
  await expect(page.getByRole("option", { name: "6ème A", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("combobox", { name: "Année scolaire" }).click()
  await page.getByRole("option", { name: "2024-2025" }).click()
  await expect(page.getByRole("combobox", { name: "Période" })).toContainText("Trimestre 3 · historique")
  await page.getByRole("combobox", { name: "Classe" }).click()
  await expect(page.getByRole("option", { name: "6ème A", exact: true })).toHaveCount(0)
  await page.getByRole("option", { name: "6ème Archives · archivée" }).click()
  await expect(page.getByText("Aya Koné")).toBeVisible()
  await expect(page.getByText("14.25/20")).toBeVisible()
  await expect(page.getByText("Publié", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /générer les bulletins|publier tous|Publier$/i })).toHaveCount(0)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "PDF" }).click()
  await expect(await download).toBeDefined()
})
