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
        gradingPeriods: [{ id: periodId, schoolYearId: "year-e2e", label: "1er trimestre", startDate: "2026-01-01", endDate: "2026-12-31", isCurrent: true, notesEntryOpen: true }],
      }),
    }))
    const grades = [{ studentId: "student-e2e-1", score: 16, maxScore: 20, comment: null }]
    let calculationStarted = false
    let completionStatus = "in_progress"
    let correctionStatus: string | null = null
    await page.route("**/api/v1/evaluations/scope*", async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lessonSlots: [{ id: slot.id, dayOfWeek: slot.day_of_week, startTime: slot.start_time, endTime: slot.end_time, roomName: slot.room_name, subjectName: slot.subject_name }],
        subjects: [{ id: "subject-e2e", name: slot.subject_name, coefficient: 4 }],
        evaluations: [{ id: "evaluation-e2e", label: "Devoir 1", type: "scheduled", coefficient: 1, subjectId: "subject-e2e", subjectName: slot.subject_name, dayOfWeek: slot.day_of_week, startTime: slot.start_time, endTime: slot.end_time, roomName: slot.room_name, grades }],
        completion: [{ subjectId: "subject-e2e", subjectName: slot.subject_name, subjectCoefficient: 4, status: completionStatus, completedAt: completionStatus === "completed" ? "2026-10-01" : null, calculationStarted, teacher: null }],
        periodState: { isClosed: false, notesEntryOpen: true, reviewOpen: false, reason: null },
        preparation: [{ subjectId: "subject-e2e", subjectName: slot.subject_name, status: completionStatus, calculationStarted, correctionStatus, evaluationCount: 1, expectedGrades: 2, enteredGrades: grades.length, missingGrades: 2 - grades.length, reasons: completionStatus === "completed" ? ["SUBJECT_COMPLETED"] : grades.length < 2 ? ["GRADES_INCOMPLETE"] : [], canStartCalculation: !calculationStarted && grades.length === 2, canRecalculate: calculationStarted && completionStatus !== "completed" && grades.length === 2, canFinalize: calculationStarted && completionStatus !== "completed" && grades.length === 2 }],
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
      else grades.push({ studentId: String(gradePayload?.studentId), score: Number(gradePayload?.score), maxScore: 20, comment: null })
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
      if (payload.status === "completed") {
        completionStatus = "completed"
        if (correctionStatus === "approved") correctionStatus = "corrected"
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
    })
    await loginAsTeacherUI(page)
    await page.goto(`/academic/notes?classId=${slot.class_id}&gradingPeriodId=${periodId}&lessonSlotId=${slot.id}`)
    await expect(page.getByRole("heading", { name: "Évaluations & notes" })).toBeVisible()
    await expect(page.getByText(`${slot.class_name} · 3ème`)).toBeVisible()
    await page.getByRole("button", { name: /Devoir 1/ }).click()
    await expect(page.getByRole("dialog", { name: "Saisie des notes" })).toBeVisible()
    await page.getByRole("spinbutton", { name: "Note de Aya Kouamé" }).fill("17")
    const firstGradeSaved = page.waitForResponse((response) => response.url().endsWith("/evaluations/evaluation-e2e/grades") && response.request().method() === "PUT")
    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Enregistrer" }).first().click()
    expect((await firstGradeSaved).status()).toBe(200)
    await expect.poll(() => gradePayload).toMatchObject({
      studentId: "student-e2e-1",
      score: 17,
      maxScore: 20,
    })

    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("link", { name: /Aller aux moyennes/ }).click()
    await expect(page.getByRole("heading", { name: "Moyennes", exact: true })).toBeVisible()
    await expect(page.getByText(/1 note manquante/)).toBeVisible()
    await expect(page.getByRole("button", { name: /Démarrer le calcul/ })).toHaveCount(0)
    await page.getByRole("link", { name: "Saisir les notes" }).click()
    await page.getByRole("button", { name: /Devoir 1/ }).click()
    await page.getByRole("spinbutton", { name: "Note de Koffi N'Guessan" }).fill("12")
    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Enregistrer" }).last().click()
    await expect.poll(() => grades.length).toBe(2)
    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("link", { name: /Aller aux moyennes/ }).click()
    const calculationSaved = page.waitForResponse((response) => response.url().endsWith("/class-subject-completion") && response.request().method() === "PUT" && (response.request().postDataJSON() as { status?: string }).status === "in_progress")
    await page.getByRole("button", { name: /Démarrer le calcul/ }).click()
    expect((await calculationSaved).status()).toBe(200)
    expect(calculationStarted).toBe(true)
    await expect(page.getByText("1 note", { exact: true }).first()).toBeVisible()
    await page.goto(`/academic/notes?classId=${slot.class_id}&gradingPeriodId=${periodId}&lessonSlotId=${slot.id}`)
    await page.getByRole("button", { name: /Devoir 1/ }).click()
    await expect(page.getByRole("spinbutton", { name: "Note de Aya Kouamé" })).toBeEnabled()
    await page.getByRole("spinbutton", { name: "Note de Aya Kouamé" }).fill("18")
    const secondGradeSaved = page.waitForResponse((response) => response.url().endsWith("/evaluations/evaluation-e2e/grades") && response.request().method() === "PUT")
    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Enregistrer" }).first().click()
    expect((await secondGradeSaved).status()).toBe(200)
    await expect.poll(() => gradePayload).toMatchObject({ studentId: "student-e2e-1", score: 18 })
    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("link", { name: /Aller aux moyennes/ }).click()
    await page.getByRole("link", { name: /Reprendre le calcul/ }).click()
    await expect(page.getByText("Conduite en masse")).toHaveCount(0)
    await page.getByRole("button", { name: "Consulter les notes de Aya Kouamé" }).click()
    await expect(page.getByRole("dialog", { name: "Notes de Aya Kouamé" })).toBeVisible()
    await page.getByRole("dialog", { name: "Notes de Aya Kouamé" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("button", { name: "Voir les moyennes par élève" }).click()
    await expect(page.getByText("Moyenne / 20")).toBeVisible()
    await expect(page.getByRole("button", { name: `Valider mes moyennes de ${slot.subject_name}` })).toBeVisible()
    await expect(page.getByText("18,00", { exact: true }).first()).toBeVisible()
    const recalculationSaved = page.waitForResponse((response) => response.url().endsWith("/class-subject-completion") && response.request().method() === "PUT" && (response.request().postDataJSON() as { status?: string }).status === "in_progress")
    await page.getByRole("button", { name: "Recalculer les moyennes" }).click()
    expect((await recalculationSaved).status()).toBe(200)
    await expect(page.getByRole("button", { name: "Recalculer les moyennes" })).toBeEnabled()
    const validationSaved = page.waitForResponse((response) => response.url().endsWith("/class-subject-completion") && response.request().method() === "PUT" && (response.request().postDataJSON() as { status?: string }).status === "completed")
    await page.getByRole("button", { name: `Valider mes moyennes de ${slot.subject_name}` }).click()
    expect((await validationSaved).status()).toBe(200)
    expect(completionStatus).toBe("completed")
    await expect(page.getByText("Moyennes validées", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Consulter les notes de Aya Kouamé" }).click()
    await expect(page.getByRole("dialog", { name: "Notes de Aya Kouamé" })).toBeVisible()
    await page.goto(`/academic/notes?classId=${slot.class_id}&gradingPeriodId=${periodId}&lessonSlotId=${slot.id}`)
    await expect(page.getByText(/Validée, saisie clôturée/)).toBeVisible()
    await page.getByRole("button", { name: /Devoir 1/ }).click()
    await expect(page.getByRole("spinbutton", { name: "Note de Aya Kouamé" })).toBeDisabled()

    await page.getByRole("dialog", { name: "Saisie des notes" }).getByRole("button", { name: "Close" }).click()
    await page.getByRole("link", { name: /Aller aux moyennes/ }).click()
    for (const width of [320, 360, 393]) {
      await page.setViewportSize({ width, height: 760 })
      await expect(page.getByRole("link", { name: /Consulter/ })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    }
    await page.getByRole("link", { name: /Consulter/ }).focus()
    await expect(page.getByRole("link", { name: /Consulter/ })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("heading", { name: "Calcul des moyennes" })).toBeVisible()

    // C30 remet la matière en cours lors de l'approbation par la direction.
    completionStatus = "in_progress"
    correctionStatus = "approved"
    await page.goto(`/academic/notes?tab=moyennes&classId=${slot.class_id}&gradingPeriodId=${periodId}`)
    await expect(page.getByText("Réclamation : correction ouverte")).toBeVisible()
    await page.getByRole("link", { name: /Reprendre le calcul/ }).click()
    await page.getByRole("button", { name: "Voir les moyennes par élève" }).click()
    await page.getByRole("button", { name: `Valider mes moyennes de ${slot.subject_name}` }).click()
    await expect(page.getByText("Moyennes validées", { exact: true })).toBeVisible()
    await page.goto(`/academic/notes?tab=moyennes&classId=${slot.class_id}&gradingPeriodId=${periodId}`)
    await expect(page.getByText("Réclamation : matière revalidée")).toBeVisible()
  })

})
