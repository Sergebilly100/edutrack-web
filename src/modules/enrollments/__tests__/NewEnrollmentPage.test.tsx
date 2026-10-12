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
  listLevels: vi.fn(),
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
  listLevels: mocks.listLevels,
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
    mocks.listYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: "active" }])
    mocks.listLevels.mockResolvedValue([{ id: "level-1", name: "CP1" }])
    mocks.listClasses.mockResolvedValue({ activeSchoolYear: { id: "year-1" }, classes: [{ id: "class-1", name: "CP1 A", isActive: true, level: { id: "level-1", name: "CP1" } }] })
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
    expect(screen.getByLabelText("E-mail du parent")).toHaveValue("parent@example.com")
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

  it("préserve une ancienne naissance invalide lors d'une modification sans toucher ce champ", async () => {
    mocks.getStudent.mockResolvedValue({ id: "student-1", firstName: "Awa", lastName: "Koné", birthDate: "9999-12-31",
      matricule: "MAT-001", classId: "class-1", className: "CP1 A", parentName: null, parentPhone: null,
      parentEmail: null, parentName2: null, parentPhone2: null })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments/enrollment-1/edit"]}>
          <Routes><Route path="/enrollments/:enrollmentId/edit" element={<NewEnrollmentPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Date existante à corriger/)).toBeInTheDocument()
    const save = screen.getByRole("button", { name: "Enregistrer et continuer" })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    await waitFor(() => expect(mocks.updateStudent).toHaveBeenCalled())
    expect(mocks.updateStudent.mock.calls[0][1]).not.toHaveProperty("birthDate")
  })

  it("n’affiche aucun profil existant et sélectionne l’année active", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments/new"]}>
          <Routes><Route path="/enrollments/new" element={<NewEnrollmentPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText("Année scolaire active")).toBeInTheDocument()
    expect(await screen.findByText("2026-2027")).toBeInTheDocument()
    expect(screen.queryByText("Année scolaire", { selector: "p" })).not.toBeInTheDocument()
    expect(screen.getByText("Renseignez le prénom et le nom de l’élève.")).toBeInTheDocument()
    expect(screen.getByLabelText("E-mail du parent")).toBeInTheDocument()
    expect(screen.getByLabelText("Nom du second parent")).toBeInTheDocument()
    expect(screen.getByLabelText("Second téléphone")).toBeInTheDocument()
    expect(screen.queryByLabelText("Nom, prénom ou matricule")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Année scolaire *" })).not.toBeInTheDocument()
  })

  it("ignore studentId dans l’URL et crée un nouveau profil avant l’inscription", async () => {
    mocks.createStudent.mockResolvedValue({ id: "student-new" })
    mocks.createEnrollment.mockResolvedValue({
      enrollment: { id: "enrollment-new", studentId: "student-new", classId: "class-1", status: "pending_cashier" },
      missingMandatoryDocuments: [], documentWarning: null,
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments/new?studentId=student-historical"]}>
          <NewEnrollmentPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText("Année scolaire active")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("H-001")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Prénom *"), { target: { value: "Aya" } })
    fireEvent.change(screen.getByLabelText("Nom *"), { target: { value: "Kone" } })
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Classe visée *" })).not.toBeDisabled())
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Classe visée *" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: /CP1 A/ }))
    fireEvent.change(screen.getByLabelText("Nom du parent"), { target: { value: "M. Kone" } })
    expect(screen.getByText("Complétez le nom et le téléphone du parent, ou laissez les deux champs vides.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer et continuer" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "2250700000000" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer et continuer" }))
    await waitFor(() => expect(mocks.createEnrollment).toHaveBeenCalledWith({
      studentId: "student-new", classId: "class-1", schoolYearId: "year-1", type: "new_registration", levelId: "level-1", expectedActiveSchoolYearId: "year-1",
    }))
    expect(mocks.createStudent).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Aya", lastName: "Kone", matricule: null }))
    expect(mocks.getStudent).not.toHaveBeenCalled()
    expect(mocks.updateStudent).not.toHaveBeenCalled()
    expect(await screen.findByText("Liste des documents")).toBeInTheDocument()
  })
})
