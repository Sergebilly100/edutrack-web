import { expect, test } from "@playwright/test"
import { loginAsDirectorUI, mockDirectorAuth } from "./helpers"

test("la direction autorise une correction publiée et voit la matière réouverte", async ({ page }) => {
  await mockDirectorAuth(page)
  const yearId = "year-c30"
  const periodId = "period-c30"
  const classId = "class-c30"
  const subjectId = "subject-c30"
  let status = "pending_exceptional_authorization"
  let decisionPayload: { decision: string; reason: string } | null = null
  let claimPayload: { studentId?: string; reason: string } | null = null

  await page.route("**/api/v1/school-years*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      schoolYears: [{ id: yearId, label: "2026-2027", startDate: "2026-09-01", endDate: "2027-07-01", status: "active" }],
    }),
  }))
  await page.route("**/api/v1/grading-periods*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      gradingPeriods: [{ id: periodId, schoolYearId: yearId, label: "Trimestre 1", startDate: "2026-09-01", endDate: "2026-12-01" }],
    }),
  }))
  await page.route("**/api/v1/classes*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      classes: [{ id: classId, name: "6ème A", level: { id: "level-c30", name: "6ème" }, schoolYear: { id: yearId, label: "2026-2027" } }],
    }),
  }))
  await page.route("**/api/v1/report-cards/classes*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      classes: [{ id: classId, name: "6ème A", isActive: true, level: { id: "level-c30", name: "6ème" } }],
    }),
  }))
  await page.route("**/api/v1/subjects*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      subjects: [{ id: subjectId, levelId: "level-c30", name: "Mathématiques", coefficient: 4 }],
    }),
  }))
  await page.route("**/api/v1/report-cards/claims*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ claims: [{
      id: "claim-c30", class_id: classId, class_name: "6ème A", student_id: "student-c30", student_name: "Aya Test", subject_id: subjectId,
      subject_name: "Mathématiques", grading_period_id: periodId, school_year_id: yearId,
      status, phase: "published", reason: "Une note publiée est incorrecte",
      requested_by_user_id: "teacher-c30", decided_by_user_id: status === "approved" ? "director-c30" : null,
      decision_reason: status === "approved" ? "Erreur confirmée après vérification" : null,
      created_at: "2026-10-01T00:00:00Z", decided_at: null, revalidated_at: null,
      regenerated_at: null, republished_at: null,
    }] }) })
  })
  await page.route("**/api/v1/report-cards/claims/students*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ students: [{ id: "student-c30", fullName: "Aya Test" }] }),
  }))
  await page.route("**/api/v1/report-cards/claims", async (route) => {
    claimPayload = route.request().postDataJSON() as { studentId?: string; reason: string }
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ claim: { id: "claim-new-c30" } }) })
  })
  await page.route("**/api/v1/report-cards/claims/claim-c30/decision", async (route) => {
    decisionPayload = route.request().postDataJSON() as { decision: string; reason: string }
    status = "approved"
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ claim: { id: "claim-c30", status, phase: "published" } }) })
  })
  await page.route("**/api/v1/report-cards/versions*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ versions: [] }) }))
  await page.route("**/api/v1/report-cards/audit*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: [] }) }))

  await loginAsDirectorUI(page)
  await page.goto(`/academic/report-card-claims?schoolYearId=${yearId}&gradingPeriodId=${periodId}&classId=${classId}&subjectId=${subjectId}`)
  await expect(page.getByRole("heading", { name: "Réclamations de bulletins" })).toBeVisible()
  await expect(page.getByText("Autorisation exceptionnelle requise")).toBeVisible()
  await expect(page.getByText("Élève concerné : Aya Test")).toBeVisible()
  await expect(page.getByText(/retirera tous les bulletins publiés/)).toBeVisible()
  await page.getByLabel("Élève concerné").click()
  await page.getByRole("option", { name: "Aya Test" }).click()
  await page.getByLabel("Motif détaillé").fill("Erreur sur le devoir d’Aya")
  await page.getByRole("button", { name: "Ouvrir la réclamation" }).click()
  await expect.poll(() => claimPayload).toMatchObject({ studentId: "student-c30", reason: "Erreur sur le devoir d’Aya" })
  await page.getByLabel("Motif de la décision").fill("Erreur confirmée après vérification")
  await page.getByRole("button", { name: "Approuver et ouvrir la correction" }).click()
  await expect.poll(() => decisionPayload).toEqual({ decision: "approved", reason: "Erreur confirmée après vérification" })
  await expect(page.getByText("Correction ouverte")).toBeVisible()
})
