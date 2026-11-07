import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClassPayload, SchoolClass } from "@/modules/academic/academic.api"
import { useAuthStore, type AuthUser } from "@/shared/store/auth.store"
import { Button } from "@/components/ui/button"

const mocks = vi.hoisted(() => ({
  years: vi.fn(), levels: vi.fn(), classes: vi.fn(), createClass: vi.fn(), teachers: vi.fn(),
  createStudent: vi.fn(), createEnrollment: vi.fn(), toast: vi.fn(), permission: vi.fn(), location: vi.fn(),
}))
vi.mock("@/modules/academic/academic.api", async (original) => ({
  ...(await original<typeof import("@/modules/academic/academic.api")>()),
  listSchoolYears: mocks.years, listLevels: mocks.levels, listClasses: mocks.classes, createClass: mocks.createClass,
}))
vi.mock("@/modules/teachers/teachers.api", () => ({ getAllTeachers: mocks.teachers }))
vi.mock("@/modules/students/students.api", () => ({ createStudent: mocks.createStudent, getStudentById: vi.fn(), updateStudent: vi.fn() }))
vi.mock("../enrollments.api", async (original) => ({ ...(await original<typeof import("../enrollments.api")>()), createEnrollment: mocks.createEnrollment }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: mocks.permission }) }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("../components/DocumentChecklist", () => ({ DocumentChecklist: () => <p>Documents du dossier</p> }))

import NewEnrollmentPage from "../NewEnrollmentPage"
import ClassesPage from "@/modules/academic/ClassesPage"

const year = { id: "550e8400-e29b-41d4-a716-446655440001", label: "2026-2027", status: "active" }
const level = { id: "550e8400-e29b-41d4-a716-446655440002", name: "CP1", orderIndex: 1 }
const klass = { id: "550e8400-e29b-41d4-a716-446655440003", name: "CP1 A", isActive: true, level, schoolYear: year, studentCount: 0, homeroomTeacher: null } as SchoolClass
let serverClasses: SchoolClass[]
function LocationProbe() {
  mocks.location(useLocation())
  const navigate = useNavigate()
  return <Button onClick={() => navigate("/enrollments/new")}>Ouvrir un autre dossier</Button>
}
function mount(path = "/enrollments/new") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><LocationProbe /><Routes>
      <Route path="/enrollments/new" element={<NewEnrollmentPage />} />
      <Route path="/academic/classes" element={<ClassesPage />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>)
}
async function choose(name: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: option }))
}
async function leaveEnrollment() {
  fireEvent.change(screen.getByLabelText("Prénom *"), { target: { value: "Aya" } })
  fireEvent.change(screen.getByLabelText("Nom *", { exact: true }), { target: { value: "Koné" } })
  fireEvent.keyDown(screen.getByLabelText("Sexe *"), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: "Féminin" }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  fireEvent.keyDown(screen.getByLabelText("Nationalité *"), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: "Côte d'Ivoire" }))
  fireEvent.change(screen.getByLabelText("Lieu de naissance *"), { target: { value: "Abidjan" } })
  await screen.findByText("2026-2027")
  await choose("Niveau visé", "CP1")
  await waitFor(() => expect(screen.getByRole("button", { name: "Créer une classe" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Créer une classe" }))
  return screen.findByRole("dialog")
}
async function saveClass() {
  fireEvent.change(screen.getByLabelText("Libellé de la classe"), { target: { value: "CP1 A" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer", exact: true }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().setUser(null)
  useAuthStore.getState().setUser({ id: "director", tenantId: "tenant", schemaName: "school_test", role: "staff" } as AuthUser)
  mocks.permission.mockReturnValue(true)
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  serverClasses = []
  mocks.years.mockResolvedValue([year])
  mocks.levels.mockResolvedValue([level])
  mocks.classes.mockImplementation(async () => ({ schoolYear: year, activeSchoolYear: year, classes: serverClasses }))
  mocks.teachers.mockResolvedValue([])
  mocks.createClass.mockImplementation(async (_payload: ClassPayload) => { serverClasses = [klass]; return klass })
  mocks.createStudent.mockResolvedValue({ id: "student" })
  mocks.createEnrollment.mockResolvedValue({ enrollment: { id: "enrollment", studentId: "student", classId: klass.id }, missingMandatoryDocuments: [] })
})

describe("inscription → création de classe → retour", () => {
  it("ignore studentId dans l’URL aussi pendant le détour de création de classe", async () => {
    mount("/enrollments/new?studentId=ancien-profil")
    await leaveEnrollment()
    expect(mocks.location.mock.lastCall![0].state.returnTo).toBe("/enrollments/new")
    fireEvent.click(screen.getByRole("button", { name: "Annuler", exact: true }))
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
  })
  it("préserve l’identité, préremplit le niveau et sélectionne la classe après relecture serveur", async () => {
    mount()
    const dialog = await leaveEnrollment()
    expect(within(dialog).getByRole("combobox", { name: "Niveau" })).toHaveTextContent("CP1")
    expect(mocks.createClass).not.toHaveBeenCalled()
    expect(mocks.createStudent).not.toHaveBeenCalled()
    expect(mocks.createEnrollment).not.toHaveBeenCalled()
    const state = mocks.location.mock.lastCall![0].state
    expect(JSON.stringify(state)).not.toContain("Aya")
    expect(JSON.stringify(state)).not.toContain("Koné")
    await saveClass()
    expect(mocks.createClass).toHaveBeenCalledWith({ name: "CP1 A", levelId: level.id, homeroomTeacherId: null, expectedSchoolYearId: year.id })
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Classe ajoutée" }))
    const readsBefore = mocks.classes.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Classe visée *" })).toHaveTextContent("CP1 A"))
    expect(mocks.classes.mock.calls.length).toBeGreaterThan(readsBefore)
    fireEvent.click(screen.getByRole("button", { name: "Créer et continuer" }))
    await waitFor(() => expect(mocks.createEnrollment).toHaveBeenCalledWith(expect.objectContaining({ classId: klass.id, schoolYearId: year.id, levelId: level.id, expectedActiveSchoolYearId: year.id })))
    expect(await screen.findByText("Documents du dossier")).toBeInTheDocument()
  })

  it("revient après abandon sans classe ni inscription créée", async () => {
    mount(); await leaveEnrollment()
    fireEvent.click(screen.getByRole("button", { name: "Annuler", exact: true }))
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
    expect(await screen.findByText(/Création de classe annulée/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer et continuer" })).toBeDisabled()
    expect(mocks.createClass).not.toHaveBeenCalled()
    expect(mocks.createEnrollment).not.toHaveBeenCalled()
    expect(mocks.createStudent).not.toHaveBeenCalled()
  })

  it("garde la confirmation bloquée tant que la relecture serveur n’est pas terminée", async () => {
    mount(); await leaveEnrollment(); await saveClass()
    let finishRead!: (value: unknown) => void
    mocks.classes.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve }))
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer et continuer" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Classe visée *" })).not.toHaveTextContent("CP1 A")
    await waitFor(() => expect(finishRead).toBeDefined())
    finishRead({ schoolYear: year, activeSchoolYear: year, classes: [klass] })
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Classe visée *" })).toHaveTextContent("CP1 A"))
    expect(mocks.classes).toHaveBeenCalledWith(year.id, { requireServer: true })
  })

  it("n’affiche pas le brouillon dans un autre dossier ouvert sur la même route", async () => {
    mount(); await leaveEnrollment()
    fireEvent.click(screen.getByRole("button", { name: "Annuler", exact: true }))
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir un autre dossier" }))
    await waitFor(() => expect(screen.getByLabelText("Prénom *")).toHaveValue(""))
    expect(screen.queryByText(/brouillon a été conservé/)).not.toBeInTheDocument()
    expect(mocks.createStudent).not.toHaveBeenCalled()
  })

  it("garde la création ouverte après erreur et permet un retour sans sélection fantôme", async () => {
    mocks.createClass.mockRejectedValue(new Error("Création refusée"))
    mount(); await leaveEnrollment()
    fireEvent.change(screen.getByLabelText("Libellé de la classe"), { target: { value: "CP1 A" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer", exact: true }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Enregistrement impossible", description: "Création refusée" })))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Annuler", exact: true }))
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer et continuer" })).toBeDisabled()
    expect(mocks.createStudent).not.toHaveBeenCalled()
  })

  it.each(["archivée", "autre niveau", "année changée", "erreur réseau"])("bloque une classe %s au retour", async (reason) => {
    mount(); await leaveEnrollment(); await saveClass()
    if (reason === "archivée") serverClasses = []
    if (reason === "autre niveau") serverClasses = [{ ...klass, level: { ...level, id: klass.id } }]
    if (reason === "année changée") {
      mocks.years.mockResolvedValue([{ ...year, status: "closed" }])
      mocks.classes.mockResolvedValue({ schoolYear: year, activeSchoolYear: null, classes: serverClasses })
    }
    if (reason === "erreur réseau") mocks.classes.mockRejectedValue(new Error("Offline"))
    fireEvent.click(screen.getByRole("button", { name: "Retour à l’inscription" }))
    expect(await screen.findByDisplayValue("Aya")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Créer et continuer" })).toBeDisabled())
    expect(await screen.findByText(reason === "erreur réseau" ? /Impossible de vérifier/ : reason === "archivée" ? /plus disponible ou a été archivée/ : reason === "autre niveau" ? /ne correspond plus/ : /active a changé/)).toBeInTheDocument()
    expect(mocks.createEnrollment).not.toHaveBeenCalled()
  })

  it("explique la permission manquante sans afficher l’action", async () => {
    mocks.permission.mockImplementation((key: string) => key !== "classes.create")
    mount()
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Niveau visé" })).toBeEnabled())
    await choose("Niveau visé", "CP1")
    expect(await screen.findByText(/demandez au directeur/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Créer une classe" })).not.toBeInTheDocument()
  })

  it("préserve la création standard sans retour contextuel", async () => {
    mount("/academic/classes")
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Ajouter une classe" })[0]).toBeEnabled())
    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter une classe" })[0])
    await screen.findByRole("dialog")
    await saveClass()
    expect(mocks.createClass).toHaveBeenCalledWith({ name: "CP1 A", levelId: level.id, homeroomTeacherId: null })
    expect(screen.queryByRole("button", { name: "Retour à l’inscription" })).not.toBeInTheDocument()
  })
})
