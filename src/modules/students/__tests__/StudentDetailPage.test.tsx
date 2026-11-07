import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/shared/api/client"

const mocks = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), getHistoricalProfile: vi.fn(), getAcademicSummary: vi.fn(), getFinancialStatus: vi.fn(), getParentAccess: vi.fn(), permissions: new Set<string>() }))
vi.mock("@/modules/students/students.api", () => ({
  getCurrentStudentProfile: mocks.getCurrentProfile, getHistoricalStudentProfile: mocks.getHistoricalProfile, getStudentAbsenceRecords: vi.fn(),
  getStudentParentAccess: mocks.getParentAccess,
  updateStudent: vi.fn(), excuseAbsence: vi.fn(), retrySmsNotification: vi.fn(),
}))
vi.mock("@/modules/enrollments/enrollments.api", async (original) => ({
  ...(await original<typeof import("@/modules/enrollments/enrollments.api")>()),
  getStudentAcademicSummary: mocks.getAcademicSummary,
  listStudentDocuments: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/modules/finance/finance.api", () => ({ getFinancialStatus: mocks.getFinancialStatus }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (permission: string) => mocks.permissions.has(permission) }) }))
vi.mock("@/shared/hooks/useTourGuide", () => ({ useTourGuide: () => ({ run: false }) }))
vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabel: () => "Élève",
  useStudentLabels: () => ({ singular: "Élève", singularLower: "élève" }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
import StudentDetailPage from "../StudentDetailPage"

const studentId = "c198137d-56c0-4e00-8db2-85ec1fe3e611"
const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/students/${studentId}?returnTo=%2Fstudents`]}>
      <Routes><Route path="/students/:studentId" element={<StudentDetailPage />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
)

const renderHistoricalPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/students/${studentId}/history`]}>
      <Routes><Route path="/students/:studentId/history" element={<StudentDetailPage mode="historical" />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
)

describe("StudentDetailPage loading errors", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permissions.clear() })
  afterEach(() => onlineManager.setOnline(true))

  it("transmet l’UUID du lien et propose une nouvelle tentative pour une erreur serveur", async () => {
    mocks.getCurrentProfile.mockRejectedValue(new ApiError("Unexpected error", { status: 500, code: "INTERNAL_SERVER_ERROR" }))
    renderPage()
    expect(await screen.findByText("Fiche indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Élève introuvable.")).not.toBeInTheDocument()
    expect(mocks.getCurrentProfile).toHaveBeenCalledWith(studentId)
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() => expect(mocks.getCurrentProfile).toHaveBeenCalledTimes(2))
  })

  it("réserve le message introuvable à une vraie réponse 404", async () => {
    mocks.getCurrentProfile.mockRejectedValue(new ApiError("Student not found", { status: 404, code: "STUDENT_NOT_FOUND" }))
    renderPage()
    expect(await screen.findByText("Élève introuvable.")).toBeInTheDocument()
    expect(screen.queryByText("Fiche indisponible")).not.toBeInTheDocument()
  })

  it("ne présente pas une connexion interrompue comme un élève absent", async () => {
    mocks.getCurrentProfile.mockRejectedValue(new ApiError("Network Error"))
    renderPage()
    expect(await screen.findByText("Fiche indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Élève introuvable.")).not.toBeInTheDocument()
  })

  it("signale une requête suspendue hors connexion sans annoncer un élève introuvable", async () => {
    onlineManager.setOnline(false)
    renderPage()
    expect(await screen.findByText("Connexion indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Élève introuvable.")).not.toBeInTheDocument()
    expect(mocks.getCurrentProfile).not.toHaveBeenCalled()
  })

  it("oriente un ancien dossier vers son historique sans afficher la fiche scolaire", async () => {
    mocks.getCurrentProfile.mockRejectedValue(new ApiError("Student is not enrolled", { status: 404, code: "STUDENT_NOT_CURRENTLY_ENROLLED" }))
    mocks.permissions.add("enrollments.view")
    renderPage()
    expect(await screen.findByText(/ne fait pas partie des élèves scolarisés confirmés dans l’année scolaire active/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Historique scolaire" })).toBeInTheDocument()
    expect(screen.queryByText("Profil détaillé élève")).not.toBeInTheDocument()
    expect(mocks.getFinancialStatus).not.toHaveBeenCalled()
  })

  it("affiche la situation financière de l’année active sur la fiche confirmée", async () => {
    mocks.permissions.add("payments.view")
    mocks.getCurrentProfile.mockResolvedValue({
      id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-1", birthDate: null,
      className: "6e A", classId: "class-1", isActive: true, parentPhone: null, parentEmail: null,
      parentPhone2: null, parentName: null, parentName2: null, note: null, createdAt: "2026-01-01T00:00:00Z",
      absenceSummary: { total: 0, excused: 0, thisMonth: 0, thisWeek: 0 },
      recentAbsences: [], documents: [], parentSms: [],
      activeSchoolYear: { id: "year-active", label: "2026-2027" },
    })
    mocks.getFinancialStatus.mockResolvedValue({
      studentId, schoolYearId: "year-active", asOfDate: "2026-09-30", currency: "FCFA",
      totalDue: 95000, discountAmount: 5000, confirmedPaid: 65000, remainingDue: 30000,
      cumulativeExpectedAtDate: 80000, standing: "late",
    })
    renderPage()
    expect(await screen.findByText("Situation financière · 2026-2027")).toBeInTheDocument()
    expect(await screen.findByText(/30\s*000 FCFA/)).toBeInTheDocument()
    expect(screen.getByText("Échéances en retard")).toBeInTheDocument()
    expect(mocks.getFinancialStatus).toHaveBeenCalledWith(studentId, "year-active")
  })

  it("affiche les comptes parents éligibles dans Infos Parents et ouvre la réinitialisation", async () => {
    mocks.permissions.add("students.edit")
    mocks.getCurrentProfile.mockResolvedValue({
      id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-1", birthDate: null,
      className: "6e A", classId: "class-1", isActive: true, parentPhone: "2250700000001", parentEmail: null,
      parentPhone2: null, parentName: "M. Koné", parentName2: null, note: null, createdAt: "2026-01-01T00:00:00Z",
      absenceSummary: { total: 0, excused: 0, thisMonth: 0, thisWeek: 0 },
      recentAbsences: [], documents: [], parentSms: [],
      activeSchoolYear: { id: "year-active", label: "2026-2027" },
    })
    mocks.getParentAccess.mockResolvedValue({
      available: true,
      parents: [{
        id: "parent-1", fullName: "Awa Kouassi", phone: "2250700000001", email: null,
        accessSentAt: "2026-01-01T00:00:00Z", accessPending: false,
      }],
    })
    renderPage()

    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Infos Parents" }), { button: 0 })
    await waitFor(() => expect(mocks.getParentAccess).toHaveBeenCalledWith(studentId))
    expect(await screen.findByText("Awa Kouassi")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser l’accès" }))
    expect(await screen.findByRole("heading", { name: "Réinitialiser l’accès parent" })).toBeInTheDocument()
    expect(mocks.getParentAccess).toHaveBeenCalledWith(studentId)
  })

  it("affiche un état vide quand aucun compte parent n’est lié", async () => {
    mocks.permissions.add("students.edit")
    mocks.getCurrentProfile.mockResolvedValue({
      id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-1", birthDate: null,
      className: "6e A", classId: "class-1", isActive: true, parentPhone: null, parentEmail: null,
      parentPhone2: null, parentName: null, parentName2: null, note: null, createdAt: "2026-01-01T00:00:00Z",
      absenceSummary: { total: 0, excused: 0, thisMonth: 0, thisWeek: 0 },
      recentAbsences: [], documents: [], parentSms: [],
      activeSchoolYear: { id: "year-active", label: "2026-2027" },
    })
    mocks.getParentAccess.mockResolvedValueOnce({ available: true, parents: [] })
    renderPage()

    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Infos Parents" }), { button: 0 })
    expect(await screen.findByText("Aucun compte parent éligible n’est lié à un élève confirmé.")).toBeInTheDocument()
  })

  it("permet de réessayer si le chargement des comptes parents échoue", async () => {
    mocks.permissions.add("students.edit")
    mocks.getCurrentProfile.mockResolvedValue({
      id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-1", birthDate: null,
      className: "6e A", classId: "class-1", isActive: true, parentPhone: null, parentEmail: null,
      parentPhone2: null, parentName: null, parentName2: null, note: null, createdAt: "2026-01-01T00:00:00Z",
      absenceSummary: { total: 0, excused: 0, thisMonth: 0, thisWeek: 0 },
      recentAbsences: [], documents: [], parentSms: [],
      activeSchoolYear: { id: "year-active", label: "2026-2027" },
    })
    mocks.getParentAccess.mockRejectedValue(new Error("network"))
    renderPage()

    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Infos Parents" }), { button: 0 })
    expect(await screen.findByText("Accès parent indisponibles")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() => expect(mocks.getParentAccess).toHaveBeenCalledTimes(2))
  })

  it("montre le dossier ancien et les finances de l’année choisie", async () => {
    mocks.permissions.add("payments.view")
    mocks.permissions.add("students.documents")
    mocks.getHistoricalProfile.mockResolvedValue({
      id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-1", birthDate: null,
      className: "6e A", classId: "class-1", isActive: true, parentPhone: "0700000000", parentEmail: null,
      parentPhone2: null, parentName: "M. Koné", parentName2: null, note: null, createdAt: "2023-01-01T00:00:00Z",
      absenceSummary: { total: 0, excused: 0, thisMonth: 0, thisWeek: 0 },
      recentAbsences: [], documents: [], parentSms: [],
      activeSchoolYear: { id: "year-active", label: "2026-2027" },
      latestConfirmedSchoolYear: { id: "year-2025", label: "2025-2026", className: "6e A" },
      confirmedInActiveYear: false,
    })
    mocks.getAcademicSummary.mockResolvedValue({
      student: { id: studentId, firstName: "Awa", lastName: "Koné", matricule: "MAT-1" },
      years: ["2025-2026", "2024-2025", "2023-2024"].map((label, index) => ({
        schoolYearId: index === 0 ? "year-2025" : `year-${2025 - index}`, schoolYearLabel: label,
        startDate: `${2025 - index}-09-01`, endDate: `${2026 - index}-06-30`,
        className: `${index + 1}e A`,
        enrollmentStatus: "confirmed", decision: "Admis(e)", financialStatus: "remaining_due",
        totalDue: 95000, discountAmount: 5000, confirmedPaid: 70000, remainingDue: 25000, currency: "FCFA",
      })),
    })
    renderHistoricalPage()
    expect(await screen.findByText("Dossier historique élève")).toBeInTheDocument()
    expect(screen.getByText(/Cet élève n’est pas inscrit dans l’année scolaire en cours : 2026-2027/)).toBeInTheDocument()
    expect(screen.getByText(/Dernière année scolaire confirmée : 2025-2026/)).toBeInTheDocument()
    expect(await screen.findByText(/25\s*000 FCFA/)).toBeInTheDocument()
    expect(screen.queryByText("2023-2024")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Année scolaire consultée")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Dossier" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Fil d'activité" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Infos Parents" })).toBeInTheDocument()
    expect(mocks.getCurrentProfile).not.toHaveBeenCalled()
  })
})
