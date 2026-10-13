import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listEnrollments: vi.fn(),
  listClassDecisions: vi.fn(),
  listSchoolYears: vi.fn(),
  listLevels: vi.fn(),
  listClasses: vi.fn(),
  listReEnrollmentCandidates: vi.fn(),
  getStudentAcademicSummary: vi.fn(),
}))

vi.mock("../enrollments.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../enrollments.api")>()),
  listEnrollments: mocks.listEnrollments,
  listReEnrollmentCandidates: mocks.listReEnrollmentCandidates,
  getStudentAcademicSummary: mocks.getStudentAcademicSummary,
  createEnrollment: vi.fn(),
}))
vi.mock("@/modules/class-decisions/class-decisions.api", () => ({
  listClassDecisions: mocks.listClassDecisions,
}))
vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: mocks.listSchoolYears,
  listLevels: mocks.listLevels,
  listClasses: mocks.listClasses,
}))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

import EnrollmentsPage from "../EnrollmentsPage"

const enrollment = (id: string, firstName: string) => ({
  id,
  studentId: `student-${id}`,
  studentFirstName: firstName,
  studentLastName: "Koné",
  classId: "class-1",
  className: "6e A",
  schoolYearId: "year-1",
  schoolYearLabel: "2026-2027",
  type: "new_registration" as const,
  status: "pending_cashier" as const,
  enrolledAt: "2026-09-01T08:00:00.000Z",
  confirmedByUserId: null,
  documentStatus: "incomplete" as const,
  missingMandatoryDocumentCount: 1,
})

describe("EnrollmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listClassDecisions.mockResolvedValue({ decisions: [] })
    mocks.listSchoolYears.mockResolvedValue([])
    mocks.listLevels.mockResolvedValue([])
    mocks.listClasses.mockResolvedValue({ classes: [] })
    mocks.listReEnrollmentCandidates.mockResolvedValue({
      candidates: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    })
    mocks.getStudentAcademicSummary.mockResolvedValue({
      student: { id: "student-1", firstName: "Awa", lastName: "Koné", matricule: "MAT-001" },
      years: [{ schoolYearId: "year-1", schoolYearLabel: "2026-2027", className: "6e A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "settled", remainingDue: 0 }],
    })
    mocks.listEnrollments.mockImplementation(({ page = 1 }: { page?: number }) => Promise.resolve({
      enrollments: [page === 1 ? enrollment("1", "Awa") : enrollment("2", "Aya")],
      pagination: { page, limit: 20, total: 21, totalPages: 2 },
    }))
  })

  it("affiche les dossiers dans un tableau paginé", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><EnrollmentsPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole("table")).toBeInTheDocument()
    expect(within(screen.getByRole("table")).getByText("Koné Awa")).toBeInTheDocument()
    expect(screen.getByText("Page 1 sur 2, 21 dossiers")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))

    await waitFor(() => expect(within(screen.getByRole("table")).getByText("Koné Aya")).toBeInTheDocument())
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith({ page: 2, limit: 20 }))
  })

  it("recherche une inscription annuelle par nom ou matricule", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments"]}><EnrollmentsPage /></MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher une inscription par nom ou matricule" }), { target: { value: "MAT-001" } })
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith(expect.objectContaining({ search: "MAT-001", page: 1 })))
  })

  it("ne plante pas quand une ancienne donnée imbriquée subsiste dans le cache", async () => {
    mocks.listEnrollments.mockResolvedValueOnce({
      enrollments: {
        enrollments: [enrollment("legacy", "Adjoua")],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><EnrollmentsPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(within(screen.getByRole("table")).getByText("Koné Adjoua")).toBeInTheDocument())
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("ouvre l’historique depuis la campagne active sélectionnée automatiquement", async () => {
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: "closed", endDate: "2027-06-30" }, { id: "year-active", label: "2027-2028", status: "active", startDate: "2027-09-01" }])
    mocks.getStudentAcademicSummary.mockResolvedValue({
      student: { id: "student-1", firstName: "Awa", lastName: "Koné", matricule: "MAT-001" },
      years: [
        { schoolYearId: "year-active", schoolYearLabel: "2027-2028", className: "5e A", enrollmentStatus: "pending_cashier", decision: "Non renseignée", financialStatus: "unavailable", remainingDue: null },
        { schoolYearId: "year-1", schoolYearLabel: "2026-2027", className: "6e A", enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "remaining_due", remainingDue: 25000, totalDue: 100000, confirmedPaid: 65000, waivedAmount: 10000 },
      ],
    })
    mocks.listReEnrollmentCandidates.mockResolvedValue({
      candidates: [{
        studentId: "student-1", studentFirstName: "Awa", studentLastName: "Koné", studentMatricule: "MAT-001",
        currentClassName: "6e A", currentSchoolYearId: "year-1", currentSchoolYearLabel: "2026-2027",
        finalDecision: null, nextLevelId: null, nextLevelName: null, enrollment: null,
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments"]}><Routes>
          <Route path="/enrollments" element={<EnrollmentsPage />} />
          <Route path="/students/:studentId/history" element={<p>Dossier complet de l’élève</p>} />
        </Routes></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole("link", { name: "Réinscriptions" }))

    expect(await screen.findByText(/Matricule : MAT-001/)).toBeInTheDocument()
    expect(screen.getByLabelText("Année d’origine clôturée")).toBeInTheDocument()
    expect(screen.getByLabelText("Niveau récent")).toBeInTheDocument()
    expect(screen.getByLabelText("Classe récente")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Voir dossier" }))
    expect(await screen.findByText("Dossier complet de l’élève")).toBeInTheDocument()
    await waitFor(() => expect(mocks.listReEnrollmentCandidates).toHaveBeenCalledWith({
      schoolYearId: "year-active", campaignStatus: "to_process", sourceSchoolYearId: undefined, levelId: undefined, classId: undefined, search: undefined, page: 1, limit: 20,
    }))
  })
})
