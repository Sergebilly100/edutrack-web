import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const studentId = "00000000-0000-4000-8000-000000000001"
const otherStudentId = "00000000-0000-4000-8000-000000000002"
const periodOneId = "00000000-0000-4000-8000-000000000011"
const periodTwoId = "00000000-0000-4000-8000-000000000012"

const studentList = [
  { id: studentId, first_name: "Aya", last_name: "Koné", class_name: "6ème A" },
  { id: otherStudentId, first_name: "Yao", last_name: "Koné", class_name: "5ème B" },
]

test.describe("Parent grades mobile", () => {
  test.use({ storageState: "e2e/.auth/parent.json" })

  test("résultats, périodes, révision et paiement restent accessibles sur petit écran", async ({ page }) => {
    await returningUser(page)
    let revision = false

    await page.route("**/api/v1/parent/students", (route) => route.fulfill({
      json: { data: studentList },
    }))
    await page.route("**/api/v1/parent/students/*/grades**", async (route) => {
      const requestedPeriod = new URL(route.request().url()).searchParams.get("gradingPeriodId")
      const selectedPeriod = requestedPeriod ?? periodTwoId
      await route.fulfill({
        json: {
          schoolYear: { id: "00000000-0000-4000-8000-000000000021", label: "2026-2027" },
          periods: [
            { id: periodTwoId, label: "Trimestre 2" },
            { id: periodOneId, label: "Trimestre 1" },
          ],
          selectedGradingPeriodId: selectedPeriod,
          resultsInRevision: revision && selectedPeriod === periodTwoId,
          subjects: selectedPeriod === periodOneId || revision ? [] : [{
            id: "00000000-0000-4000-8000-000000000031",
            name: "Mathématiques et sciences appliquées",
            average: 16.25,
            evaluations: [{
              id: "00000000-0000-4000-8000-000000000041",
              label: "Composition écrite",
              date: "2026-10-15",
              type: "scheduled",
              coefficient: 2,
              score: 8.5,
              maxScore: 10,
            }],
          }],
        },
      })
    })

    await page.goto("/parent/grades")
    await expect(page.getByRole("heading", { name: "Notes", exact: true })).toBeVisible()
    await expect(page.getByText("Mathématiques et sciences appliquées")).toBeVisible()
    await expect(page.getByText("8,5 / 10")).toBeVisible()

    for (const width of [320, 360, 393]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(page.getByText("Mathématiques et sciences appliquées")).toBeVisible()
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(documentWidth).toBeLessThanOrEqual(width)
    }

    await page.getByRole("combobox", { name: "Période" }).click()
    await page.getByRole("option", { name: "Trimestre 1" }).click()
    await expect(page.getByText(
      "Les résultats apparaîtront ici après validation des moyennes par l’enseignant",
    )).toBeVisible()

    await page.getByRole("combobox", { name: "Période" }).click()
    await page.getByRole("option", { name: "Trimestre 2" }).click()
    await expect(page.getByText("16,25")).toBeVisible()
    revision = true
    await page.reload()
    await expect(page.getByText("Résultats en cours de révision par l’établissement")).toBeVisible()
    await expect(page.getByText("Mathématiques et sciences appliquées")).not.toBeVisible()

    const parentNav = page.getByRole("navigation", { name: "Navigation principale" })
    await expect(parentNav.getByRole("link", { name: "Notes" })).toHaveAttribute("aria-current", "page")
    await expect(parentNav.getByRole("link", { name: "Paiements" })).toHaveCount(0)
    await parentNav.getByRole("link", { name: "Accueil" }).click()
    await page.getByRole("link", { name: "Frais et paiements" }).click()
    await expect(page).toHaveURL(new RegExp(`/parent/payments\\?student=${studentId}`))
    await expect(page.getByRole("combobox", { name: "Enfant" })).toContainText("Koné Aya")
  })
})
