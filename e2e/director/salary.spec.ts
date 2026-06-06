import { expect, test } from "@playwright/test"

import { loginAsDirectorUI, mockDirectorAuth, selectSalaryMonth, formatMonthLabel } from "./helpers"

// Mois hardcodé - pas d'appel API réel
const PAYABLE_MONTH = "2026-06"
const TEACHER_VACATAIRE_ID = "teacher-vacataire-e2e-1"

const mockSalaryApis = async (
  page: import("@playwright/test").Page,
  options: { status?: "pending" | "paid"; salaryRecordId?: string } = {}
) => {
  const status = options.status ?? "pending"
  const salaryRecordId = options.salaryRecordId ?? "salary-record-e2e-1"

  // Override permissions pour inclure salary.compute (absent de mockDirectorAuth)
  await page.route("**/api/v1/permissions/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        permissions: [
          "teachers.view", "teachers.edit", "teachers.block",
          "students.view",
          "schedule.view", "schedule.edit",
          "attendance.view",
          "salary.view", "salary.compute", "salary.mark_paid", "salary.export",
          "validations.view",
          "rooms.view",
          "import.students", "import.teachers", "import.schedule",
          "settings.school", "settings.positions", "settings.sms_templates",
          "subscriptions.view", "subscriptions.revenue",
        ],
      }),
    })
  })

  await page.route("**/api/v1/billing/salary/summary*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        month: PAYABLE_MONTH,
        lastComputedAt: "2026-06-01T08:00:00Z",
        items: [
          {
            teacherId: TEACHER_VACATAIRE_ID,
            teacherName: "M. Vacataire E2E",
            teacherType: "vacataire",
            hoursPlanned: 20,
            hoursDone: 18,
            hourlyRate: 5000,
            totalFcfa: 90000,
            amountAlreadyPaid: status === "paid" ? 90000 : 0,
            status,
            salaryRecordId,
            isPartiallyPaid: false,
            paidAt: status === "paid" ? "2026-06-05T10:00:00Z" : null,
          },
        ],
      }),
    })
  })

  await page.route("**/api/v1/billing/salary/compute*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, computedCount: 1 }),
    })
  })

  await page.route(`**/api/v1/billing/salary/${salaryRecordId}/status*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })

  // queueSchoolSalaryExport - utilisé dans un ancien bouton (maintenant c'est export/bulk)
  await page.route("**/api/v1/billing/salary/export/school*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobId: "export-job-e2e-1" }),
    })
  })
  // queueBulkSalaryExport - utilisé par le bouton "Export bilan PDF" → dialog "Exporter le bilan"
  await page.route("**/api/v1/billing/salary/export/bulk*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobId: "export-job-e2e-1" }),
    })
  })

  // Unpaid alerts
  await page.route("**/api/v1/billing/salary/unpaid-alerts*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ referenceMonth: PAYABLE_MONTH, count: 0, totalRemainingFcfa: 0, months: [] }),
    })
  })

  // getTeacherSalaryDetails - chargé à l'ouverture du dialog "Marquer comme payé"
  await page.route(`**/api/v1/billing/salary/${TEACHER_VACATAIRE_ID}*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        teacher: {
          id: TEACHER_VACATAIRE_ID,
          name: "M. Vacataire E2E",
          type: "vacataire",
          hourlyRate: 5000,
        },
        summary: {
          month: PAYABLE_MONTH,
          hoursPlanned: 20,
          hoursDone: 18,
          hoursDoneSinceLastPayment: 18,
          totalFcfa: 90000,
          amountAlreadyPaid: 0,
          amountRemainingToPayNow: 90000,
          status: status === "paid" ? "paid" : "pending",
          isPartiallyPaid: false,
          paidAt: null,
          lastComputedAt: "2026-06-01T08:00:00Z",
        },
        payment: { paidAt: null },
        payments: [],
        rows: [],
      }),
    })
  })
}

test.describe("Page salaires", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockDirectorAuth(page)
    await mockSalaryApis(page)
    await loginAsDirectorUI(page)
    await page.locator('a[href="/salaries"]:visible').first().click()
    await expect(page).toHaveURL(/\/salaries/)
    await selectSalaryMonth(page, PAYABLE_MONTH)
    await expect(page.getByTestId("salaries-page")).toBeVisible()
  })

  test("le tableau s'affiche avec les profs vacataires", async ({ page }) => {
    await expect(page.getByTestId("salaries-vacataire-section")).toBeVisible()
    await expect(page.getByTestId("salaries-vacataire-table")).toBeVisible()
    await expect(page.getByText("Vacataire").first()).toBeVisible()
  })

  test("le calcul des salaires crée les records", async ({ page }) => {
    await page.getByTestId("salaries-compute-button").click()
    await page.getByTestId("salaries-compute-confirm-button").click()

    await expect(
      page.locator("[data-testid^='salary-vacataire-row-']").first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("marquer un prof comme payé change le badge statut", async ({ page }) => {
    const markPaidButton = page.locator("[data-testid^='salary-vacataire-mark-paid-']").first()
    await expect(markPaidButton).toBeVisible()

    const markPaidButtonTestId = await markPaidButton.getAttribute("data-testid")
    const teacherId = markPaidButtonTestId?.replace("salary-vacataire-mark-paid-", "")
    expect(teacherId).toBeTruthy()

    // Mock pour renvoyer un statut "paid" après paiement
    await page.route("**/api/v1/billing/salary/summary*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          month: PAYABLE_MONTH,
          lastComputedAt: "2026-06-01T08:00:00Z",
          items: [
            {
              teacherId: TEACHER_VACATAIRE_ID,
              teacherName: "M. Vacataire E2E",
              teacherType: "vacataire",
              hoursPlanned: 20,
              hoursDone: 18,
              hourlyRate: 5000,
              totalFcfa: 90000,
              amountAlreadyPaid: 90000,
              status: "paid",
              salaryRecordId: "salary-record-e2e-1",
              isPartiallyPaid: false,
              paidAt: "2026-06-05T10:00:00Z",
            },
          ],
        }),
      })
    })

    await markPaidButton.click()

    // Le dialog de paiement s'ouvre - saisir un montant et confirmer
    await page.getByLabel("Saisissez le nombre d'heure que vous souhaitez payer").fill("18")
    await expect(page.getByRole("button", { name: "Confirmer le paiement" })).toBeEnabled()
    await page.getByRole("button", { name: "Confirmer le paiement" }).click()

    await expect(
      page.getByTestId(`salary-vacataire-status-${teacherId as string}`)
    ).toContainText("Payé", { timeout: 15000 })
  })

  test("l'export PDF est queué (bouton télécharger apparaît)", async ({ page }) => {
    const JOB_ID = "export-job-e2e-1"

    // Mock export bulk - retourne un jobId (cliqué via "Export bilan PDF" → dialog)
    await page.route("**/api/v1/billing/salary/export/bulk*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobId: JOB_ID }),
      })
    })

    // Mock poll status du job - retourne "completed" avec downloadUrl
    await page.route(`**/api/v1/jobs/${JOB_ID}/status*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: JOB_ID,
          state: "completed",
          rawState: "completed",
          downloadUrl: "https://storage.example.com/export-e2e.pdf",
          failedReason: null,
        }),
      })
    })

    // Cliquer le bouton "Export bilan PDF" - ouvre le dialog "Exporter le bilan"
    await page.getByTestId("salaries-export-school-button").click()
    // Le dialog pré-remplit les périodes avec selectedMonth → bouton Générer actif
    await page.getByRole("dialog", { name: "Exporter le bilan" }).getByRole("button", { name: "Générer" }).click()

    await expect(page.getByTestId("salaries-export-job-panel")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("salaries-export-download-link")).toBeVisible({ timeout: 15000 })
  })
})

test("formatMonthLabel génère le bon libellé pour 2026-06", () => {
  expect(formatMonthLabel(PAYABLE_MONTH)).toBe("juin 2026")
})
