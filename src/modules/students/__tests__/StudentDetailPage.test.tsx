import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/shared/api/client"

const mocks = vi.hoisted(() => ({ getStudent: vi.fn() }))
vi.mock("@/modules/students/students.api", () => ({
  getStudentById: mocks.getStudent, getStudentAbsenceRecords: vi.fn(),
  updateStudent: vi.fn(), excuseAbsence: vi.fn(), retrySmsNotification: vi.fn(),
}))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }))
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

describe("StudentDetailPage loading errors", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => onlineManager.setOnline(true))

  it("transmet l’UUID du lien et propose une nouvelle tentative pour une erreur serveur", async () => {
    mocks.getStudent.mockRejectedValue(new ApiError("Unexpected error", { status: 500, code: "INTERNAL_SERVER_ERROR" }))
    renderPage()
    expect(await screen.findByText("Fiche indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Élève introuvable.")).not.toBeInTheDocument()
    expect(mocks.getStudent).toHaveBeenCalledWith(studentId)
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await waitFor(() => expect(mocks.getStudent).toHaveBeenCalledTimes(2))
  })

  it("réserve le message introuvable à une vraie réponse 404", async () => {
    mocks.getStudent.mockRejectedValue(new ApiError("Student not found", { status: 404, code: "STUDENT_NOT_FOUND" }))
    renderPage()
    expect(await screen.findByText("Élève introuvable.")).toBeInTheDocument()
    expect(screen.queryByText("Fiche indisponible")).not.toBeInTheDocument()
  })

  it("ne présente pas une connexion interrompue comme un élève absent", async () => {
    mocks.getStudent.mockRejectedValue(new ApiError("Network Error"))
    renderPage()
    expect(await screen.findByText("Fiche indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Élève introuvable.")).not.toBeInTheDocument()
  })

  it("signale une requête suspendue hors connexion sans annoncer un élève introuvable", async () => {
    onlineManager.setOnline(false)
    renderPage()
    expect(await screen.findByText("Connexion indisponible")).toBeInTheDocument()
    expect(screen.queryByText("Élève introuvable.")).not.toBeInTheDocument()
    expect(mocks.getStudent).not.toHaveBeenCalled()
  })
})
