import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const listStudentRisksMock = vi.fn()
const listTeacherRisksMock = vi.fn()
const listLevelsMock = vi.fn()
const listClassesMock = vi.fn()
const hasPermissionMock = vi.fn()

vi.mock("@/modules/dashboard/dashboard.api", () => ({
  listStudentRisks: (...args: unknown[]) => listStudentRisksMock(...args),
  listTeacherRisks: (...args: unknown[]) => listTeacherRisksMock(...args),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  listLevels: () => listLevelsMock(),
  listClasses: () => listClassesMock(),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (permission: string) => hasPermissionMock(permission) }),
}))

import RiskDetailsPage from "@/modules/dashboard/RiskDetailsPage"
import { actionItemToNotification, DASHBOARD_ACTION_ROUTES } from "@/modules/dashboard/dashboard-action-notifications"

const pagination = { page: 1, limit: 10, total: 11, totalPages: 2 }

function renderPage(entry = "/dashboard/risks") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[entry]}><RiskDetailsPage /></MemoryRouter></QueryClientProvider>)
}

describe("RiskDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasPermissionMock.mockReturnValue(true)
    listLevelsMock.mockResolvedValue([{ id: "level-1", name: "6e" }])
    listClassesMock.mockResolvedValue({ classes: [{ id: "class-1", name: "6e A", level: { id: "level-1" } }] })
    listStudentRisksMock.mockResolvedValue({
      students: [{ studentId: "student-1", studentName: "Awa Koné", schoolLevelId: "level-1", schoolLevelName: "6e", classId: "class-1", className: "6e A", absencesSignal: true, gradesSignal: false, paymentSignal: true, riskScore: 2, level: "warning", computedAt: "2026-09-22" }],
      pagination,
    })
    listTeacherRisksMock.mockResolvedValue({
      teachers: [{ teacherId: "teacher-1", teacherName: "M. Yao", absenceCount: 3, latenessCount: 0, attendanceRate: 75, absencesSignal: true, latenessSignal: false, riskScore: 1, level: "attention" }],
      pagination,
    })
  })

  it("ouvre le suivi professeur sans charger les élèves pour teachers.view seul", async () => {
    hasPermissionMock.mockImplementation((permission: string) => permission === "teachers.view")
    renderPage("/dashboard/risks?tab=teachers")
    expect(await screen.findByRole("link", { name: "M. Yao" })).toBeInTheDocument()
    expect(listStudentRisksMock).not.toHaveBeenCalled()
    expect(listLevelsMock).not.toHaveBeenCalled()
    expect(listClassesMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("tab", { name: "Élèves" })).not.toBeInTheDocument()
  })

  it.each([
    { absencesSignal: false, latenessSignal: true, absenceCount: 0, latenessCount: 4, riskScore: 1, level: "attention", reason: "Retards" },
    { absencesSignal: true, latenessSignal: true, absenceCount: 3, latenessCount: 4, riskScore: 2, level: "warning", reason: "Absences Retards" },
  ])("affiche la raison réelle du risque enseignant : $reason", async (risk) => {
    listTeacherRisksMock.mockResolvedValue({ teachers: [{ teacherId: "teacher-1", teacherName: "M. Yao", ...risk }], pagination })
    renderPage("/dashboard/risks?tab=teachers")
    const name = await screen.findByRole("link", { name: "M. Yao" })
    for (const reason of risk.reason.split(" ")) expect(name.closest("tr")).toHaveTextContent(reason)
    expect(screen.getAllByRole("link", { name: "M. Yao" })).toHaveLength(1)
  })

  it("affiche les filtres et les élèves dans un tableau paginé", async () => {
    renderPage()
    expect(await screen.findByRole("columnheader", { name: "Élève" })).toBeInTheDocument()
    expect(screen.getByText("Awa Koné")).toBeInTheDocument()
    expect(screen.queryByText("Baisse de moyenne")).not.toBeInTheDocument()
    expect(screen.getByText("Paiement")).toBeInTheDocument()
    expect(screen.getByText("Page 1 / 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))
    await waitFor(() => expect(listStudentRisksMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })))
  })

  it("conserve l’année et la période du dashboard pour les risques élèves", async () => {
    renderPage("/dashboard/risks?tab=students&schoolYearId=year-1&gradingPeriodId=period-2")
    expect(await screen.findByRole("columnheader", { name: "Élève" })).toBeInTheDocument()
    expect(listStudentRisksMock).toHaveBeenCalledWith(expect.objectContaining({
      schoolYearId: "year-1",
      gradingPeriodId: "period-2",
      atRisk: true,
      page: 1,
      limit: 10,
    }))
  })

  it("lit les filtres élèves depuis l'URL et propose de les réinitialiser", async () => {
    renderPage("/dashboard/risks?tab=students&category=absences&level=critical&levelId=level-1")
    expect(await screen.findByRole("columnheader", { name: "Élève" })).toBeInTheDocument()
    expect(listStudentRisksMock).toHaveBeenLastCalledWith(expect.objectContaining({ category: "absences", riskLevel: "critical", schoolLevelId: "level-1", atRisk: true }))
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }))
    await waitFor(() => expect(listStudentRisksMock).toHaveBeenLastCalledWith(expect.objectContaining({ category: undefined, riskLevel: undefined, schoolLevelId: undefined })))
    expect(screen.queryByRole("button", { name: "Réinitialiser les filtres" })).not.toBeInTheDocument()
  })

  it("ouvre l'onglet professeurs avec le motif d'absences présélectionné, sans mois par défaut", async () => {
    renderPage("/dashboard/risks?tab=teachers&signal=absences")
    expect(await screen.findByRole("link", { name: "M. Yao" })).toBeInTheDocument()
    expect(listTeacherRisksMock).toHaveBeenLastCalledWith(expect.objectContaining({ signal: "absences", month: undefined, atRisk: true }))
    expect(screen.getByText(/absences répétées/, { selector: "p" })).toBeInTheDocument()
  })

  it("affiche les absences répétées dans l’onglet professeur", async () => {
    renderPage()
    const teachersTab = await screen.findByRole("tab", { name: "Professeurs" })
    fireEvent.mouseDown(teachersTab)
    fireEvent.click(teachersTab)
    expect(await screen.findByRole("columnheader", { name: "Absences répétées" })).toBeInTheDocument()
    expect(screen.getByText("M. Yao")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByLabelText("Mois")).toHaveAttribute("type", "month")
  })

  it("ouvre les risques enseignants depuis l’action sur la même fenêtre glissante", async () => {
    const notification = actionItemToNotification({
      id: "action-teacher", type: "teacher_at_risk", referenceId: null,
      priority: "high", message: "1 professeur(s) à suivre pour leur assiduité", generatedAt: "2026-09-27",
    })
    expect(notification.title).toBe("Professeurs à suivre")
    expect(notification.targetHref).toBe("/dashboard/risks?tab=teachers")
    expect(DASHBOARD_ACTION_ROUTES.student_at_risk.href).toBe("/dashboard/risks?tab=students")
    expect(DASHBOARD_ACTION_ROUTES.teacher_absences_high.href).toBe("/dashboard/risks?tab=teachers&signal=absences")
    renderPage(notification.targetHref)

    expect(await screen.findByRole("columnheader", { name: "Absences répétées" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Professeurs" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByLabelText("Mois")).toHaveValue("")
    expect(listTeacherRisksMock).toHaveBeenCalledWith({ month: undefined, atRisk: true, page: 1, limit: 10 })
    expect(screen.getByRole("link", { name: "M. Yao" })).toHaveAttribute("href", expect.stringContaining("/teachers/teacher-1"))
  })
})
