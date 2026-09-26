import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getEnrollment: vi.fn(),
  createEnrollment: vi.fn(),
  createStudent: vi.fn(),
  updateEnrollment: vi.fn(),
  verifyDocuments: vi.fn(),
  getStudent: vi.fn(),
  updateStudent: vi.fn(),
  listYears: vi.fn(),
  listClasses: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("../enrollments.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../enrollments.api")>()),
  getEnrollment: mocks.getEnrollment,
  createEnrollment: mocks.createEnrollment,
  updateEnrollment: mocks.updateEnrollment,
  verifyStudentDocuments: mocks.verifyDocuments,
}))
vi.mock("@/modules/students/students.api", () => ({
  createStudent: mocks.createStudent,
  getStudentById: mocks.getStudent,
  updateStudent: mocks.updateStudent,
}))
vi.mock("@/modules/academic/academic.api", () => ({
  listSchoolYears: mocks.listYears,
  listClasses: mocks.listClasses,
}))
vi.mock("@/shared/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("../components/DocumentChecklist", () => ({ DocumentChecklist: () => <p>Liste des documents</p> }))

import NewEnrollmentPage from "../NewEnrollmentPage"

describe("NewEnrollmentPage historical edit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
    mocks.getEnrollment.mockResolvedValue({
      id: "enrollment-1",
      studentId: "student-1",
      studentFirstName: "Awa",
      studentLastName: "Koné",
      classId: "class-1",
      className: "CP1 A",
      schoolYearId: "year-1",
      schoolYearLabel: "2026-2027",
      type: "new_registration",
      status: "pending_cashier",
      enrolledAt: "2026-08-01T00:00:00.000Z",
      confirmedByUserId: null,
      documentStatus: "complete",
      missingMandatoryDocumentCount: 0,
    })
    mocks.getStudent.mockResolvedValue({
      id: "student-1",
      firstName: "Awa",
      lastName: "Koné",
      birthDate: "2018-01-10",
      matricule: "MAT-001",
      classId: "class-1",
      className: "CP1 A",
      parentName: "M. Koné",
      parentPhone: "2250700000000",
      parentEmail: "parent@example.com",
      parentName2: null,
      parentPhone2: null,
    })
    mocks.listYears.mockResolvedValue([{ id: "year-1", label: "2026-2027" }])
    mocks.listClasses.mockResolvedValue({ classes: [{ id: "class-1", name: "CP1 A", isActive: true, level: { id: "level-1", name: "CP1" } }] })
    mocks.updateStudent.mockResolvedValue({ id: "student-1" })
    mocks.updateEnrollment.mockResolvedValue({
      id: "enrollment-1", studentId: "student-1", classId: "class-1", status: "pending_cashier",
    })
    mocks.verifyDocuments.mockResolvedValue({
      documents: [], missingMandatoryDocuments: [], dossierComplete: true, notificationQueued: false,
    })
  })

  it("recharge puis modifie l’élève et son inscription sans créer de doublon", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments/enrollment-1/edit"]}>
          <Routes><Route path="/enrollments/:enrollmentId/edit" element={<NewEnrollmentPage />} /><Route path="/enrollments" element={<p>Historique des inscriptions</p>} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const firstName = await screen.findByDisplayValue("Awa")
    expect(screen.getByDisplayValue("M. Koné")).toBeInTheDocument()
    fireEvent.change(firstName, { target: { value: "Aya" } })
    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer et continuer" }))

    await waitFor(() => expect(mocks.updateStudent).toHaveBeenCalledWith("student-1", expect.objectContaining({
      firstName: "Aya",
      lastName: "Koné",
      parentName: "M. Koné",
    })))
    expect(mocks.updateEnrollment).toHaveBeenCalledWith("enrollment-1", { classId: "class-1" })
    expect(mocks.updateStudent.mock.calls[0][1]).not.toHaveProperty("classId")
    expect(await screen.findByText("Liste des documents")).toBeInTheDocument()
    expect(screen.queryByText("Caisse", { selector: "li span" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Terminer le dossier/ }))
    await waitFor(() => expect(mocks.verifyDocuments).toHaveBeenCalledWith("student-1"))
    expect(await screen.findByText("Historique des inscriptions")).toBeInTheDocument()
  })

  it("inscrit un profil historique existant sans recréer l’élève ni écrire sa classe sur le profil", async () => {
    mocks.getStudent.mockResolvedValue({
      id: "student-historical", firstName: "Aya", lastName: "Kone", matricule: "H-001",
      classId: null, className: null, parentName: null, parentPhone: null,
    })
    mocks.updateStudent.mockResolvedValue({ id: "student-historical" })
    mocks.createEnrollment.mockResolvedValue({
      enrollment: { id: "enrollment-new", studentId: "student-historical", classId: "class-1", status: "pending_cashier" },
      missingMandatoryDocuments: [], documentWarning: null,
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments/new?studentId=student-historical"]}>
          <NewEnrollmentPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByDisplayValue("H-001")).toBeInTheDocument()
    fireEvent.keyDown(screen.getAllByRole("combobox")[0], { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "2026-2027" }))
    await waitFor(() => expect(screen.getAllByRole("combobox")[1]).not.toBeDisabled())
    fireEvent.keyDown(screen.getAllByRole("combobox")[1], { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: /CP1 A/ }))
    fireEvent.click(screen.getByRole("button", { name: "Créer et continuer" }))
    await waitFor(() => expect(mocks.createEnrollment).toHaveBeenCalledWith({
      studentId: "student-historical", classId: "class-1", schoolYearId: "year-1", type: "new_registration",
    }))
    expect(mocks.createStudent).not.toHaveBeenCalled()
    expect(mocks.updateStudent).toHaveBeenCalledWith("student-historical", expect.objectContaining({ firstName: "Aya", matricule: "H-001" }))
    expect(mocks.updateStudent.mock.calls[0][1]).not.toHaveProperty("classId")
    expect(await screen.findByText("Liste des documents")).toBeInTheDocument()
  })
})
