import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const listStudentRisksMock = vi.fn()
const listTeacherRisksMock = vi.fn()
const listLevelsMock = vi.fn()
const listClassesMock = vi.fn()

vi.mock("@/modules/dashboard/dashboard.api", () => ({
  listStudentRisks: (...args: unknown[]) => listStudentRisksMock(...args),
  listTeacherRisks: (...args: unknown[]) => listTeacherRisksMock(...args),
}))

vi.mock("@/modules/academic/academic.api", () => ({
  listLevels: () => listLevelsMock(),
  listClasses: () => listClassesMock(),
}))

vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))

import RiskDetailsPage from "@/modules/dashboard/RiskDetailsPage"

const pagination = { page: 1, limit: 10, total: 11, totalPages: 2 }

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><RiskDetailsPage /></MemoryRouter></QueryClientProvider>)
}

describe("RiskDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listLevelsMock.mockResolvedValue([{ id: "level-1", name: "6e" }])
    listClassesMock.mockResolvedValue({ classes: [{ id: "class-1", name: "6e A", level: { id: "level-1" } }] })
    listStudentRisksMock.mockResolvedValue({
      students: [{ studentId: "student-1", studentName: "Awa Koné", schoolLevelId: "level-1", schoolLevelName: "6e", classId: "class-1", className: "6e A", absencesSignal: true, gradesSignal: false, paymentSignal: true, riskScore: 2, level: "warning", computedAt: "2026-09-22" }],
      pagination,
    })
    listTeacherRisksMock.mockResolvedValue({
      teachers: [{ teacherId: "teacher-1", teacherName: "M. Yao", absenceCount: 3, attendanceRate: 75, absencesSignal: true, riskScore: 1, level: "attention" }],
      pagination,
    })
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
})
