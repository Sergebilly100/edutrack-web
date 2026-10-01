import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const activeYear = { id: "11111111-1111-4111-8111-111111111111", label: "2026-2027", status: "active" }
const previousYear = { id: "22222222-2222-4222-8222-222222222222", label: "2025-2026", status: "closed" }
const olderYear = { id: "44444444-4444-4444-8444-444444444444", label: "2024-2025", status: "closed" }
const oldestYear = { id: "55555555-5555-4555-8555-555555555555", label: "2023-2024", status: "closed" }
const studentId = "33333333-3333-4333-8333-333333333333"

test("C25 : la fiche historique et ses finances sont ouvertes depuis Réinscriptions sur mobile", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const user = { id: "director-c25", role: "director", name: "Directeur C25", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false }
    const payload = pathname.endsWith("/auth/refresh") ? { accessToken: "token-c25", tokenType: "Bearer", expiresIn: 3600, user }
      : pathname.endsWith("/auth/me") ? { user, tenant: { id: "tenant-c25", status: "active", trialEndsAt: null } }
      : pathname.endsWith("/permissions/me") ? { permissions: ["enrollments.view", "enrollments.create", "students.view", "students.documents", "report_cards.view", "attendance.view"] }
      : pathname.endsWith("/school/info") ? { onboarding_completed: true }
      : pathname.endsWith("/school-years") ? { schoolYears: [activeYear, previousYear, olderYear, oldestYear] }
      : pathname.endsWith("/levels") ? { levels: [] }
      : pathname.endsWith("/classes") ? { schoolYear: activeYear, activeSchoolYear: activeYear, classes: [] }
      : pathname.endsWith("/enrollments/re-enrollment/candidates") ? {
        candidates: [{ studentId, studentFirstName: "Awa", studentLastName: "Koné", studentMatricule: "MAT-25",
          currentClassName: "6e A", currentSchoolYearId: previousYear.id, currentSchoolYearLabel: previousYear.label,
          finalDecision: "promoted", nextLevelId: null, nextLevelName: null, enrollment: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }
      : pathname.endsWith(`/enrollments/re-enrollment/students/${studentId}/summary`) ? {
        student: { id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25" },
        years: [
          { schoolYearId: activeYear.id, schoolYearLabel: activeYear.label, startDate: "2026-09-01", endDate: "2027-06-30", className: "5e A", enrollmentStatus: "pending_cashier", decision: "Non renseignée", financialStatus: "unavailable", remainingDue: null, currency: "FCFA" },
          { schoolYearId: previousYear.id, schoolYearLabel: previousYear.label, startDate: "2025-09-01", endDate: "2026-06-30", className: "6e A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "remaining_due", remainingDue: 25000, totalDue: 100000, confirmedPaid: 65000, waivedAmount: 10000, currency: "FCFA" },
          { schoolYearId: olderYear.id, schoolYearLabel: olderYear.label, startDate: "2024-09-01", endDate: "2025-06-30", className: "CM2 A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "settled", remainingDue: 0, totalDue: 90000, confirmedPaid: 90000, waivedAmount: 0, currency: "FCFA" },
          { schoolYearId: oldestYear.id, schoolYearLabel: oldestYear.label, startDate: "2023-09-01", endDate: "2024-06-30", className: "CM1 A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "settled", remainingDue: 0, totalDue: 80000, confirmedPaid: 80000, waivedAmount: 0, currency: "FCFA" },
        ],
      }
      : pathname.endsWith(`/students/${studentId}/historical-profile`) ? { data: {
        id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25", birthDate: null,
        className: "6e A", classId: "class-old", isActive: true,
        parentName: "M. Koné", parentPhone: "0700000000", parentEmail: null, parentName2: null, parentPhone2: null,
        note: null, createdAt: "2023-09-01T00:00:00Z",
        absenceSummary: { total: 1, excused: 0, thisMonth: 0, thisWeek: 0 },
        recentAbsences: [], documents: [], parentSms: [],
        activeSchoolYear: activeYear, latestConfirmedSchoolYear: { id: previousYear.id, label: previousYear.label, className: "6e A" },
        confirmedInActiveYear: false,
      } }
      : pathname.endsWith(`/students/${studentId}/dossier`) ? { student: { id: studentId, firstName: "Awa", lastName: "Koné" }, events: [{ type: "enrollment", date: "2023-09-01", label: "Inscription 2023-2024", detail: null, schoolYearId: oldestYear.id }] }
      : pathname.endsWith(`/students/${studentId}/report-cards`) ? { reportCards: [
        { id: "card-2025", periodLabel: "Trimestre 3", schoolYearId: previousYear.id, schoolYearLabel: previousYear.label, className: "6e A", generalAverage: 14.5, rank: 4, classHeadcount: 32, publishedAt: "2026-06-20" },
        { id: "card-2023", periodLabel: "Trimestre 2", schoolYearId: oldestYear.id, schoolYearLabel: oldestYear.label, className: "CM1 A", generalAverage: 13, rank: 6, classHeadcount: 30, publishedAt: "2024-03-20" },
      ] }
      : pathname.endsWith(`/students/${studentId}/report-cards/card-2025`) ? { reportCard: {
        id: "card-2025", periodLabel: "Trimestre 3", className: "6e A", generalAverage: 14.5, rank: 4, classHeadcount: 32, classAverage: 11.8, status: "published",
        lines: [{ id: "line-math", subjectName: "Mathématiques", lineType: "subject", average: 15, coefficient: 3, rank: 5 }],
      } }
      : pathname.endsWith(`/students/${studentId}/report-cards/card-2025/pdf`) ? { jobId: "job-card-2025" }
      : pathname.endsWith("/jobs/job-card-2025/status") ? { jobId: "job-card-2025", status: "done", downloadUrl: "data:application/pdf;base64,JVBERi0xLjQK" }
      : pathname.endsWith(`/students/${studentId}/absences`) ? [
        { id: "absence-2025", date: "2025-11-12", subject: "Mathématiques", teacherName: "Mme Traoré", className: "6e A", startTime: "08:00", endTime: "09:00", status: "absent", excuseReason: null, smsPhone1: { phone: null, status: "not_sent", sentAt: null }, smsPhone2: { phone: null, status: "not_sent", sentAt: null } },
        { id: "absence-2023", date: "2023-11-12", subject: "Français", teacherName: "M. Yao", className: "CM1 A", startTime: "09:00", endTime: "10:00", status: "absent", excuseReason: null, smsPhone1: { phone: null, status: "not_sent", sentAt: null }, smsPhone2: { phone: null, status: "not_sent", sentAt: null } },
      ].filter((row) => {
        const params = new URL(route.request().url()).searchParams
        return row.date >= (params.get("from") ?? "") && row.date <= (params.get("to") ?? "")
      })
      : pathname.endsWith(`/documents/student/${studentId}`) ? { data: [{ id: "archive-doc-1", entityType: "student", entityId: studentId, type: "releve_notes", name: "Bulletin 2023-2024", createdAt: "2024-06-01T00:00:00Z", url: "/archive.pdf" }] }
      : pathname.endsWith(`/students/${studentId}/enrollment-documents`) ? { documents: [] }
      : pathname.endsWith("/enrollments") ? { enrollments: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }
      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto("/enrollments?tab=re-enrollment")
  await expect(page.getByRole("button", { name: "Voir dossier" })).toBeVisible()
  await page.getByRole("button", { name: "Voir dossier" }).click()
  await expect(page).toHaveURL(new RegExp(`/enrollments/re-enrollment/students/${studentId}$`))
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.getByText(/Cet élève n’est pas inscrit dans l’année scolaire en cours : 2026-2027/)).toBeVisible()
    await expect(page.getByText(/Dernière année scolaire confirmée : 2025-2026/)).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Année scolaire consultée" })).toContainText("2025-2026")
    await expect(page.getByText("2023-2024", { exact: true })).toHaveCount(0)
    await expect(page.getByText(/25\s*000 FCFA/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  if (process.env.C25_CAPTURE_DEMO === "1") {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({ path: "docs/qa/c25-dossier-historique-demo.png", fullPage: true })
  }
  await page.getByRole("tab", { name: "Bulletins" }).click()
  await expect(page.getByText("Trimestre 3")).toBeVisible()
  await expect(page.getByText("Trimestre 2")).toHaveCount(0)
  await page.getByRole("button", { name: "Consulter" }).click()
  const bulletin = page.getByRole("dialog", { name: "Bulletin · Trimestre 3" })
  await expect(bulletin.getByText("Mathématiques")).toBeVisible()
  if (process.env.C25_CAPTURE_DEMO === "1") {
    await page.screenshot({ path: "docs/qa/c25-bulletin-detail-demo.png" })
  }
  await page.keyboard.press("Escape")
  await expect(bulletin).toBeHidden()
  if (process.env.C25_CAPTURE_DEMO === "1") {
    await page.screenshot({ path: "docs/qa/c25-bulletins-historiques-demo.png", fullPage: true })
  }
  const pdfRequest = page.waitForRequest((request) => request.url().endsWith(`/students/${studentId}/report-cards/card-2025/pdf`) && request.method() === "POST")
  const pdfStatusRequest = page.waitForRequest((request) => request.url().endsWith("/jobs/job-card-2025/status") && request.method() === "GET")
  await page.getByRole("button", { name: "Télécharger le PDF" }).click()
  await pdfRequest
  await pdfStatusRequest
  await page.getByRole("combobox", { name: "Année scolaire consultée" }).click()
  await page.getByRole("option", { name: "2023-2024 · CM1 A" }).click()
  await expect(page.locator('[data-tour="student-detail-profile"]')).toContainText("CM1 A · 2023-2024")
  await expect(page.getByText("Trimestre 2")).toBeVisible()
  await expect(page.getByText("Trimestre 3")).toHaveCount(0)
  await page.getByRole("combobox", { name: "Année scolaire consultée" }).click()
  await page.getByRole("option", { name: "Toutes les années" }).click()
  await expect(page.getByText("2024-2025", { exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "Dossier" }).click()
  await expect(page.getByText("Bulletin 2023-2024")).toBeVisible()
  await expect(page.getByRole("button", { name: "Remplacer" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Supprimer" })).toHaveCount(0)
  await page.getByRole("tab", { name: "Fil d'activité" }).click()
  await expect(page.getByText("Inscription 2023-2024")).toBeVisible()
})
