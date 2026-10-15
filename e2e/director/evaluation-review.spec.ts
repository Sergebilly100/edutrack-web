import { expect, test } from "@playwright/test"
import { navigateMenu, returningUser } from "../ui-helpers"

test("la direction consulte les évaluations et notes depuis le menu Académique sur mobile", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/academic/evaluations/options**", async (route) => {
    await route.fulfill({ json: {
      schoolYears: [{ id: "11111111-1111-4111-8111-111111111111", label: "2026-2027", active: true }],
      gradingPeriods: [
        { id: "22222222-2222-4222-8222-222222222223", label: "Deuxième trimestre", schoolYearId: "11111111-1111-4111-8111-111111111111", isCurrent: false, isFuture: true, hasEvaluations: false },
        { id: "22222222-2222-4222-8222-222222222222", label: "Premier trimestre", schoolYearId: "11111111-1111-4111-8111-111111111111", isCurrent: true, isFuture: false, hasEvaluations: true },
      ],
      levels: [{ id: "33333333-3333-4333-8333-333333333333", label: "6e" }],
      classes: [{ id: "44444444-4444-4444-8444-444444444444", label: "6e A", levelId: "33333333-3333-4333-8333-333333333333" }],
      subjects: [{ id: "55555555-5555-4555-8555-555555555555", label: "Mathématiques", levelId: "33333333-3333-4333-8333-333333333333" }],
      teachers: [{ id: "66666666-6666-4666-8666-666666666666", label: "Professeur A" }],
    } })
  })
  await page.route("**/api/v1/academic/evaluations?**", async (route) => {
    await route.fulfill({ json: {
      items: [{ id: "77777777-7777-4777-8777-777777777777", label: "Devoir 1", date: "2026-10-01", type: "scheduled", coefficient: 2,
        subject: { id: "55555555-5555-4555-8555-555555555555", name: "Mathématiques" },
        teacher: { id: "66666666-6666-4666-8666-666666666666", name: "Professeur A" },
        class: { id: "44444444-4444-4444-8444-444444444444", name: "6e A" },
        level: { id: "33333333-3333-4333-8333-333333333333", name: "6e" },
        period: { id: "22222222-2222-4222-8222-222222222222", name: "Premier trimestre" },
        notes: [{ studentId: "88888888-8888-4888-8888-888888888888", studentName: "Kouassi Awa", score: 14, maxScore: 20, comment: "Bien" },
          { studentId: "99999999-9999-4999-8999-999999999999", studentName: "Koné Moussa", score: null, maxScore: null, comment: null }],
      }], summary: { evaluations: 1, grades: 1, missing: 1 }, page: 1, pageSize: 20, total: 1,
    } })
  })
  await page.route("**/api/v1/academic/evaluations/spontaneous?**", async (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") ?? 1)
    const firstStudent = { id: "88888888-8888-4888-8888-888888888888", name: "Kouassi Awa", matricule: "CI-001", subjects: [
        { id: "55555555-5555-4555-8555-555555555555", name: "Mathématiques", notes: [
          { evaluationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", date: "2026-10-02", adjustment: 3,
            teacher: { id: "66666666-6666-4666-8666-666666666666", name: "Professeur A" }, className: "6e A", comment: "Participation" },
        ] },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Français", notes: [
          { evaluationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", date: "2026-10-03", adjustment: -2,
            teacher: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Professeur B" }, className: "6e A", comment: null },
        ] },
      ] }
    const otherStudents = Array.from({ length: pageNumber === 1 ? 19 : 20 }, (_, index) => {
      const number = (pageNumber - 1) * 20 + index + (pageNumber === 1 ? 2 : 1)
      return { id: `student-${number}`, name: `Élève ${number}`, matricule: `CI-${number}`, subjects: [
        { id: "55555555-5555-4555-8555-555555555555", name: "Mathématiques", notes: [
          { evaluationId: `sp-${number}`, date: "2026-10-02", adjustment: 1,
            teacher: { id: "66666666-6666-4666-8666-666666666666", name: "Professeur A" }, className: "6e A", comment: null },
        ] },
      ] }
    })
    await route.fulfill({ json: { totalStudents: 1000, totalNotes: 1001, page: pageNumber, pageSize: 20,
      students: pageNumber === 1 ? [firstStudent, ...otherStudents] : otherStudents } })
  })
  await page.goto("/login")
  await page.getByLabel("Identifiant", { exact: true }).fill(process.env.E2E_DIRECTOR_IDENTIFIER ?? "directeur@sainte-marie.ci")
  await page.getByLabel("Mot de passe", { exact: true }).fill(process.env.E2E_DIRECTOR_PASSWORD ?? "Test1234!")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await navigateMenu(page, "Académique", "Évaluations et notes")
  await expect(page).toHaveURL(/\/academic\/evaluations$/)
  await expect(page.getByRole("heading", { name: "Suivi des évaluations et notes" })).toBeVisible()
  await expect(page.getByRole("note")).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "Trier et regrouper" })).toContainText("Retard")
  const filters = page.getByRole("region", { name: "Filtres" })
  await filters.getByRole("combobox", { name: "Période" }).click()
  await page.getByRole("option", { name: "Deuxième trimestre (à venir)" }).click()
  await expect(filters.getByRole("combobox", { name: "Période" })).toContainText("Deuxième trimestre (à venir)")
  await filters.getByRole("combobox", { name: "Période" }).click()
  await page.getByRole("option", { name: "Premier trimestre" }).click()
  await expect(filters.getByRole("combobox", { name: "Classe" })).toBeDisabled()
  await filters.getByRole("combobox", { name: "Niveau" }).click()
  await page.getByRole("option", { name: "6e" }).click()
  await expect(filters.getByRole("combobox", { name: "Classe" })).toBeEnabled()
  await filters.getByRole("combobox", { name: "Classe" }).click()
  await page.getByRole("option", { name: "6e A" }).click()
  await expect(filters.getByRole("combobox", { name: "Matière" })).toBeEnabled()
  await page.getByRole("button", { name: /Devoir 1/ }).click()
  await expect(page.getByText("14 / 20")).toBeVisible()
  await expect(page.getByText("Note manquante")).toBeVisible()
  await expect(page.getByText("Bien")).toBeVisible()
  await page.getByRole("tab", { name: "Notes spontanées" }).click()
  const spontaneous = page.getByRole("region", { name: "Notes spontanées" })
  const student = spontaneous.getByRole("button", { name: /Kouassi Awa/ })
  await expect(student).toBeVisible()
  await expect(student).toHaveAttribute("aria-expanded", "false")
  await expect(student).toContainText("6e A · CI-001")
  await student.click()
  await expect(spontaneous.getByText("+3 points")).toBeVisible()
  await expect(spontaneous.getByText("-2 points")).toBeVisible()
  await expect(spontaneous.getByText("Note manquante")).toHaveCount(0)
  await expect(spontaneous.getByRole("navigation", { name: "Pagination des élèves" })).toContainText("Page 1 sur 50")
  await spontaneous.getByLabel("Aller à la page").fill("17")
  await spontaneous.getByRole("button", { name: "Aller" }).click()
  await expect(spontaneous.getByRole("button", { name: /Élève 321/ })).toBeVisible()
  await expect(spontaneous.getByRole("navigation", { name: "Pagination des élèves" })).toContainText("Page 17 sur 50")
})
