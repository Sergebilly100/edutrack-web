import { expect, test } from "@playwright/test"
import { returningUser } from "../ui-helpers"

const activeYear = { id: "11111111-1111-4111-8111-111111111111", label: "2026-2027", status: "active", startDate: "2026-09-01", endDate: "2027-06-30" }
const previousYear = { id: "22222222-2222-4222-8222-222222222222", label: "2025-2026", status: "closed", startDate: "2025-09-01", endDate: "2026-06-30" }
const olderYear = { id: "44444444-4444-4444-8444-444444444444", label: "2024-2025", status: "closed", startDate: "2024-09-01", endDate: "2025-06-30" }
const oldestYear = { id: "55555555-5555-4555-8555-555555555555", label: "2023-2024", status: "closed", startDate: "2023-09-01", endDate: "2024-06-30" }
const studentId = "33333333-3333-4333-8333-333333333333"

test("C42 : la campagne ouvre l’historique annuel de l’élève sur mobile", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const user = { id: "director-c25", role: "director", name: "Directeur C25", phone: null, email: null, profilePhotoUrl: null, mustChangePassword: false }
    const payload = pathname.endsWith("/auth/refresh") ? { accessToken: "token-c25", tokenType: "Bearer", expiresIn: 3600, user }
      : pathname.endsWith("/auth/me") ? { user, tenant: { id: "tenant-c25", status: "active", trialEndsAt: null } }
      : pathname.endsWith("/permissions/me") ? { permissions: ["enrollments.view", "enrollments.create", "students.view", "students.documents", "report_cards.view", "evaluations.view", "attendance.view", "payments.view"] }
      : pathname.endsWith("/school/info") ? { onboarding_completed: true }
      : pathname.endsWith("/school-years") ? { schoolYears: [activeYear, previousYear, olderYear, oldestYear] }
      : pathname.endsWith("/levels") ? { levels: [] }
      : pathname.endsWith("/classes") ? { schoolYear: activeYear, activeSchoolYear: activeYear, classes: [] }
      : pathname.endsWith("/enrollments/re-enrollment/candidates") ? {
        candidates: [{ studentId, studentFirstName: "Awa", studentLastName: "Koné", studentMatricule: "MAT-25",
          currentClassName: "6e A", currentSchoolYearId: previousYear.id, currentSchoolYearLabel: previousYear.label,
          finalDecision: "promoted", nextLevelId: null, nextLevelName: null, enrollment: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }, counts: { toProcess: 1, awaitingCashier: 0, blockedUnpaid: 0, confirmed: 0, all: 1 },
      }
      : pathname.endsWith(`/students/${studentId}/academic-history`) ? {
        student: { id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25" },
        years: [
          { schoolYearId: activeYear.id, schoolYearLabel: activeYear.label, schoolYearStatus: "active", startDate: "2026-09-01", endDate: "2027-06-30", className: "5e A", enrollmentStatus: "pending_cashier", decision: "Non renseignée", financialStatus: "unavailable", remainingDue: null, currency: "FCFA" },
          { schoolYearId: previousYear.id, schoolYearLabel: previousYear.label, schoolYearStatus: "closed", startDate: "2025-09-01", endDate: "2026-06-30", className: "6e A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "remaining_due", remainingDue: 25000, totalDue: 100000, confirmedPaid: 65000, waivedAmount: 10000, currency: "FCFA" },
          { schoolYearId: olderYear.id, schoolYearLabel: olderYear.label, schoolYearStatus: "closed", startDate: "2024-09-01", endDate: "2025-06-30", className: "CM2 A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "settled", remainingDue: 0, totalDue: 90000, confirmedPaid: 90000, waivedAmount: 0, currency: "FCFA" },
          { schoolYearId: oldestYear.id, schoolYearLabel: oldestYear.label, schoolYearStatus: "closed", startDate: "2023-09-01", endDate: "2024-06-30", className: "CM1 A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "settled", remainingDue: 0, totalDue: 80000, confirmedPaid: 80000, waivedAmount: 0, currency: "FCFA" },
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
      : pathname.endsWith(`/students/${studentId}/academic-years/${oldestYear.id}/results`) ? { studentId, schoolYearId: oldestYear.id, evaluations: [{ id: "old-evaluation", periodLabel: "Trimestre 1", subjectName: "Français", label: "Devoir ancien", score: 13, maxScore: 20, coefficient: 1 }], averages: [{ id: "old-average", periodLabel: "Trimestre 1", subjectName: null, average: 12, rank: 5 }], conduct: [{ id: "old-conduct", periodLabel: "Trimestre 1", note: 16, coefficient: 1 }] }
      : pathname.endsWith(`/students/${studentId}/academic-years/${previousYear.id}/results`) ? { studentId, schoolYearId: previousYear.id, evaluations: [{ id: "recent-evaluation", periodLabel: "Trimestre 1", subjectName: "Mathématiques", label: "Devoir récent", score: 17, maxScore: 20, coefficient: 2 }], averages: [], conduct: [] }
      : pathname.endsWith(`/students/${studentId}/payments`) ? { payments: new URL(route.request().url()).searchParams.get("school_year_id") === oldestYear.id
        ? [{ id: "old-payment", studentId, schoolYearId: oldestYear.id, amount: 5000, method: "cash", source: "cashier_manual", status: "waived_by_school", providerReference: null, schoolReceiptReference: null, receiptNumber: "REM-OLD", cancelledAt: null, cancellationReason: null, paymentDate: "2024-05-01", createdAt: "2024-05-01" }]
        : [{ id: "recent-payment", studentId, schoolYearId: previousYear.id, amount: 30000, method: "cash", source: "cashier_manual", status: "confirmed", providerReference: null, schoolReceiptReference: null, receiptNumber: "RC-RECENT", cancelledAt: null, cancellationReason: null, paymentDate: "2025-10-01", createdAt: "2025-10-01" }] }
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
      : pathname.endsWith("/enrollments") ? { enrollments: [{
        id: "enrollment-c42", studentId, studentFirstName: "Awa", studentLastName: "Koné",
        classId: "class-old", className: "6e A", schoolYearId: previousYear.id, schoolYearLabel: previousYear.label,
        type: "re_registration", status: "confirmed", enrolledAt: "2025-09-01T08:00:00.000Z",
        documentStatus: "complete", missingMandatoryDocumentCount: 0,
      }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto("/enrollments?tab=re-enrollment")
  await expect(page.getByRole("button", { name: "Voir dossier" })).toBeVisible()
  await page.getByRole("button", { name: "Voir dossier" }).click()
  await expect(page).toHaveURL(new RegExp(`/students/${studentId}/history\\?year=${previousYear.id}&returnTo=`))
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
  await page.getByRole("button", { name: "Télécharger", exact: true }).click()
  await pdfRequest
  await pdfStatusRequest
  await page.getByRole("combobox", { name: "Année scolaire consultée" }).click()
  await page.getByRole("option", { name: "2023-2024 · CM1 A" }).click()
  await expect(page.locator('[data-tour="student-detail-profile"]')).toContainText("CM1 A · 2023-2024")
  await expect(page.getByText("Trimestre 2")).toBeVisible()
  await expect(page.getByText("Trimestre 3")).toHaveCount(0)
  await page.getByRole("tab", { name: "Dossier" }).click()
  await expect(page.getByText("Bulletin 2023-2024")).toBeVisible()
  await expect(page.getByRole("button", { name: "Remplacer" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Supprimer" })).toHaveCount(0)
  await page.getByRole("tab", { name: "Fil d'activité" }).click()
  await expect(page.getByText("Inscription 2023-2024")).toBeVisible()
  await page.getByRole("tab", { name: "Résultats" }).click()
  await expect(page.getByText("Devoir ancien")).toBeVisible()
  await expect(page.getByText("Devoir récent")).toHaveCount(0)
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole("tab", { name: "Paiements et remises" }).click()
  await expect(page.getByText("Remise accordée")).toBeVisible()
  await expect(page.getByText("RC-RECENT")).toHaveCount(0)
  await page.goto("/enrollments")
  await page.setViewportSize({ width: 320, height: 800 })
  await expect(page.locator("article").getByText("Koné Awa")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.C42_CAPTURE === "1") await page.screenshot({ path: "/tmp/c42-inscriptions-mobile.png", fullPage: true })
  const searchedRequest = page.waitForRequest((request) => request.url().includes("/api/v1/enrollments?") && new URL(request.url()).searchParams.get("search") === "MAT-25")
  await page.getByRole("searchbox", { name: "Rechercher une inscription par nom ou matricule" }).fill("MAT-25")
  await searchedRequest
  await page.locator("article").getByRole("link", { name: "Voir le dossier" }).click()
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/enrollments?search=MAT-25")
  await page.getByRole("button", { name: "Retour" }).click()
  await expect(page.getByRole("searchbox", { name: "Rechercher une inscription par nom ou matricule" })).toHaveValue("MAT-25")
})

test("C42 : une fiche active ouvre une année passée puis revient à l’année active", async ({ page }) => {
  await returningUser(page)
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const user = { id: "director-c42", role: "director", name: "Directeur C42", mustChangePassword: false }
    const profile = {
      id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25", birthDate: null,
      className: "5e A", classId: "class-active", isActive: true,
      parentName: null, parentPhone: null, parentEmail: null, parentName2: null, parentPhone2: null,
      note: null, createdAt: "2023-09-01T00:00:00Z",
      absenceSummary: { total: 0, excused: 0, thisMonth: 0, thisWeek: 0 },
      recentAbsences: [], documents: [], parentSms: [], activeSchoolYear: activeYear,
    }
    const payload = pathname.endsWith("/auth/refresh") ? { accessToken: "token-c42", tokenType: "Bearer", expiresIn: 3600, user }
      : pathname.endsWith("/auth/me") ? { user, tenant: { id: "tenant-c42", status: "active", trialEndsAt: null } }
      : pathname.endsWith("/permissions/me") ? { permissions: ["students.view"] }
      : pathname.endsWith("/school/info") ? { onboarding_completed: true }
      : pathname.endsWith(`/students/${studentId}/school-profile`) ? { data: profile }
      : pathname.endsWith(`/students/${studentId}/historical-profile`) ? { data: {
        ...profile, latestConfirmedSchoolYear: { id: previousYear.id, label: previousYear.label, className: "6e A" }, confirmedInActiveYear: true,
      } }
      : pathname.endsWith(`/students/${studentId}/academic-history`) ? { student: { id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25" }, years: [
        { schoolYearId: activeYear.id, schoolYearLabel: activeYear.label, schoolYearStatus: "active", startDate: activeYear.startDate, endDate: activeYear.endDate, className: "5e A", enrollmentStatus: "confirmed", decision: "Non renseignée", financialStatus: "unavailable", remainingDue: null, totalDue: null, confirmedPaid: null, waivedAmount: null },
        { schoolYearId: previousYear.id, schoolYearLabel: previousYear.label, schoolYearStatus: "closed", startDate: previousYear.startDate, endDate: previousYear.endDate, className: "6e A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "unavailable", remainingDue: null, totalDue: null, confirmedPaid: null, waivedAmount: null },
      ] }
      : pathname.endsWith(`/students/${studentId}/dossier`) ? { student: { id: studentId, firstName: "Awa", lastName: "Koné" }, events: [] }
      : pathname.endsWith("/students/history-directory") ? { data: [{ id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25", className: "5e A", isActive: true }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
      : pathname.endsWith("/students") ? { data: [{ id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-25", className: "5e A", isActive: true }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
      : { data: [] }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto(`/students/${studentId}`)
  await page.getByRole("button", { name: "Historique scolaire" }).click()
  await expect(page).toHaveURL(new RegExp(`/students/${studentId}/history$`))
  await expect(page.getByRole("combobox", { name: "Année scolaire consultée" })).toContainText(activeYear.label)
  await page.getByRole("combobox", { name: "Année scolaire consultée" }).click()
  await page.getByRole("option", { name: `${previousYear.label} · 6e A` }).click()
  await expect(page.locator('[data-tour="student-detail-profile"]')).toContainText(`6e A · ${previousYear.label}`)
  await expect(page.getByText("Total dû")).toHaveCount(0)
  await page.getByRole("button", { name: "Voir l’année active" }).click()
  await expect(page).toHaveURL(new RegExp(`/students/${studentId}$`))
  await page.goto("/students/history")
  await expect(page.getByText("Koné Awa")).toBeVisible()
  await page.getByRole("link", { name: "Ouvrir le dossier" }).click()
  await expect(page).toHaveURL(new RegExp(`/students/${studentId}/history`))
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/students/history")
  await expect(page.locator('[data-tour="student-detail-profile"]')).toContainText(`5e A · ${activeYear.label}`)

  await page.goto("/records")
  for (const width of [320, 360, 393]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.getByRole("searchbox", { name: "Nom ou matricule" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Ouvrir le dossier" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 320 && process.env.C42_CAPTURE === "1") await page.screenshot({ path: "/tmp/c42-dossiers-mobile.png", fullPage: true })
  }
  await page.getByRole("searchbox", { name: "Nom ou matricule" }).fill("MAT-25")
  await page.getByRole("button", { name: "Inscrits cette année" }).click()
  await expect(page.getByText("5e A", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Ouvrir le dossier" }).click()
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/records?search=MAT-25&scope=current")
  await page.getByRole("button", { name: "Retour" }).click()
  await expect(page.getByRole("searchbox", { name: "Nom ou matricule" })).toHaveValue("MAT-25")
  await expect(page.getByRole("button", { name: "Inscrits cette année" })).toHaveAttribute("aria-pressed", "true")
})
