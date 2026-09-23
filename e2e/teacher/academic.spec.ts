import { expect, test } from "@playwright/test"

import { loginAsTeacherUI, mockTeacherFlowApis } from "./helpers"

test.describe("Espace académique professeur", () => {
  test("Pixel 5 : saisie des notes en modale et validation après consultation des moyennes", async ({ page }) => {
    const { slot } = await mockTeacherFlowApis(page)
    const periodId = "period-e2e-t1"
    const students = [
      { id: "student-e2e-1", classId: slot.class_id, className: slot.class_name, firstName: "Aya", lastName: "Kouamé", matricule: "A1", isActive: true },
      { id: "student-e2e-2", classId: slot.class_id, className: slot.class_name, firstName: "Koffi", lastName: "N'Guessan", matricule: "A2", isActive: true },
    ]

    await page.route("**/api/v1/academic/teacher-context", async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        classes: [{ id: slot.class_id, name: slot.class_name, levelId: "level-e2e", levelName: "3ème", schoolYearId: "year-e2e", schoolYearLabel: "2026-2027", isHomeroomTeacher: false }],
        gradingPeriods: [{ id: periodId, schoolYearId: "year-e2e", label: "1er trimestre", startDate: "2026-01-01", endDate: "2026-12-31", isCurrent: true }],
      }),
    }))
    const grades = [{ studentId: "student-e2e-1", score: 16, maxScore: 20, comment: null }, { studentId: "student-e2e-2", score: 12, maxScore: 20, comment: null }]
    let calculationStarted = false
    let completionStatus = "in_progress"
    await page.route("**/api/v1/evaluations/scope*", async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lessonSlots: [{ id: slot.id, dayOfWeek: slot.day_of_week, startTime: slot.start_time, endTime: slot.end_time, roomName: slot.room_name, subjectName: slot.subject_name }],
        subjects: [{ id: "subject-e2e", name: slot.subject_name, coefficient: 4 }],
        evaluations: [{ id: "evaluation-e2e", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "subject-e2e", subjectName: slot.subject_name, dayOfWeek: slot.day_of_week, startTime: slot.start_time, endTime: slot.end_time, roomName: slot.room_name, grades }],
        completion: [{ subjectId: "subject-e2e", subjectName: slot.subject_name, subjectCoefficient: 4, status: completionStatus, completedAt: completionStatus === "completed" ? "2026-10-01" : null, calculationStarted, teacher: null }],
      }),
    }))
    await page.route("**/api/v1/students?*", async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: students, pagination: { page: 1, limit: 100, total: 2, totalPages: 1 } }),
    }))
    let gradePayload: Record<string, unknown> | null = null
    await page.route("**/api/v1/evaluations/evaluation-e2e/grades", async (route) => {
      gradePayload = route.request().postDataJSON() as Record<string, unknown>
      const grade = grades.find((item) => item.studentId === gradePayload?.studentId)
      if (grade) grade.score = Number(gradePayload.score)
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    })
    await page.route("**/api/v1/conduct/inputs/scope*", async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isAvailable: true, students: students.map((student) => ({ studentId: student.id, fullName: `${student.firstName} ${student.lastName}`, matricule: student.matricule, input: null })) }),
    }))
    await page.route("**/api/v1/class-subject-completion", async (route) => {
      const payload = route.request().postDataJSON() as { status?: string }
      calculationStarted = true
      if (payload.status === "completed") completionStatus = "completed"
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    })
    await loginAsTeacherUI(page)
    await page.goto(`/academic/notes?classId=${slot.class_id}&gradingPeriodId=${periodId}&lessonSlotId=${slot.id}`)
    await expect(page.getByRole("heading", { name: "Évaluations & notes" })).toBeVisible()
    await expect(page.getByText(`${slot.class_name} · 3ème`)).toBeVisible()
    await page.getByRole("button", { name: /Devoir 1/ }).click()
    await expect(page.getByRole("dialog", { name: "Saisie des notes" })).toBeVisible()
    await page.getByRole("spinbutton", { name: "Note de Aya Kouamé" }).fill("17")
    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Enregistrer" }).first().click()
    await expect.poll(() => gradePayload).toMatchObject({
      studentId: "student-e2e-1",
      score: 17,
      maxScore: 20,
    })

    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("button", { name: "Calculer les moyennes" }).click()
    await expect(page.getByText("1 note", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Conduite en masse")).toHaveCount(0)
    await page.getByRole("button", { name: "Consulter les notes de Aya Kouamé" }).click()
    await expect(page.getByRole("dialog", { name: "Notes de Aya Kouamé" })).toBeVisible()
    await page.getByRole("dialog", { name: "Notes de Aya Kouamé" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("button", { name: "Voir les moyennes par élève" }).click()
    await expect(page.getByText("Moyenne / 20")).toBeVisible()
    await expect(page.getByRole("button", { name: `Valider mes moyennes de ${slot.subject_name}` })).toBeVisible()
    await expect(page.getByText("17,00", { exact: true }).first()).toBeVisible()
    await page.getByRole("button", { name: `Valider mes moyennes de ${slot.subject_name}` }).click()
    await expect(page.getByText("Moyennes validées", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Consulter les notes de Aya Kouamé" }).click()
    await expect(page.getByRole("dialog", { name: "Notes de Aya Kouamé" })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasHorizontalOverflow).toBe(false)
  })

})
