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
  listRequiredDocumentTypes: vi.fn(),
  getStudentById: vi.fn(),
}))

vi.mock("../enrollments.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../enrollments.api")>()),
  listEnrollments: mocks.listEnrollments,
  listReEnrollmentCandidates: mocks.listReEnrollmentCandidates,
  getStudentAcademicSummary: mocks.getStudentAcademicSummary,
  listRequiredDocumentTypes: mocks.listRequiredDocumentTypes,
  createEnrollment: vi.fn(),
}))
vi.mock("@/modules/class-decisions/class-decisions.api", () => ({
  listClassDecisions: mocks.listClassDecisions,
}))
vi.mock("@/modules/students/students.api", () => ({ getStudentById: mocks.getStudentById }))
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
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
    mocks.listClassDecisions.mockResolvedValue({ decisions: [] })
    mocks.listSchoolYears.mockResolvedValue([])
    mocks.listLevels.mockResolvedValue([])
    mocks.listClasses.mockResolvedValue({ classes: [] })
    mocks.listRequiredDocumentTypes.mockResolvedValue([])
    mocks.getStudentById.mockImplementation((studentId: string) => Promise.resolve({ id: studentId, matricule: `MAT-${studentId}` }))
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
    expect(within(screen.getByRole("table")).getByText("KONÉ Awa")).toBeInTheDocument()
    expect(screen.getByText(/Page 1 sur 2, 21 dossiers/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }))

    await waitFor(() => expect(within(screen.getByRole("table")).getByText("KONÉ Aya")).toBeInTheDocument())
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith({ page: 2, limit: 20 }))
  })

  it("recherche une inscription annuelle par nom ou matricule", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/enrollments"]}><EnrollmentsPage /></MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByRole("searchbox", { name: "Élève, nom ou matricule" }), { target: { value: "MAT-001" } })
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith(expect.objectContaining({ search: "MAT-001", page: 1 })))
  })

  it("affiche la synthèse annuelle et un seul bandeau quand les documents manquent", async () => {
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: "active" }])
    mocks.listEnrollments.mockImplementation(({ type, limit = 20 }: { type?: string; limit?: number }) => Promise.resolve({
      enrollments: limit === 1 ? [] : [enrollment("1", "Awa"), enrollment("2", "Aya")],
      pagination: { page: 1, limit, total: type === "re_registration" ? 2 : type === "new_registration" ? 6 : 8, totalPages: 1 },
    }))
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)
    expect(await screen.findByText("Total inscrits")).toBeInTheDocument()
    const summary = screen.getByLabelText("Synthèse des inscriptions")
    expect(within(summary).getByText("8")).toBeInTheDocument()
    expect(within(summary).getByText("6")).toBeInTheDocument()
    expect(within(summary).getByText("2")).toBeInTheDocument()
    expect(screen.getAllByText("Les documents requis ne sont pas configurés.")).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Configurer" })).toHaveAttribute("href", "/settings?tab=scolarite")
    expect(within(screen.getByRole("table")).queryByText("Dossier")).not.toBeInTheDocument()
  })

  it("affiche le dossier configuré, trie les élèves et ouvre la ligne entière", async () => {
    mocks.listRequiredDocumentTypes.mockResolvedValue([{ id: "doc-1", levelId: "level-1", levelName: "6e", name: "Acte de naissance", isMandatory: true, isActive: true }])
    mocks.listEnrollments.mockResolvedValue({
      enrollments: [enrollment("2", "Zoé"), { ...enrollment("1", "Awa"), documentStatus: "complete", missingMandatoryDocumentCount: 0 }],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/enrollments"]}><Routes>
        <Route path="/enrollments" element={<EnrollmentsPage />} />
        <Route path="/students/:studentId/history" element={<p>Dossier complet de l’élève</p>} />
      </Routes></MemoryRouter>
    </QueryClientProvider>)
    const table = await screen.findByRole("table")
    expect(screen.queryByText("Les documents requis ne sont pas configurés.")).not.toBeInTheDocument()
    expect(within(table).getByText("Complet")).toBeInTheDocument()
    expect(within(table).getByText("Incomplet")).toBeInTheDocument()
    expect(await within(table).findByText("MAT-student-1")).toBeInTheDocument()
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("KONÉ Awa")
    fireEvent.click(within(table).getByRole("button", { name: "Élève" }))
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("KONÉ Zoé")
    fireEvent.keyDown(within(table).getByRole("row", { name: /KONÉ Zoé/ }), { key: "Enter" })
    expect(await screen.findByText("Dossier complet de l’élève")).toBeInTheDocument()
  })

  it.each([
    { status: "confirmed", yearStatus: "active", destination: "Profil actif" },
    { status: "pending_cashier", yearStatus: "active", destination: "Documents actifs" },
    { status: "confirmed", yearStatus: "closed", destination: "Historique scolaire" },
  ] as const)("ouvre $destination depuis une ligne $yearStatus ($status)", async ({ status, yearStatus, destination }) => {
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: yearStatus }])
    mocks.listEnrollments.mockResolvedValue({
      enrollments: [{ ...enrollment("1", "Awa"), status }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/enrollments"]}><Routes>
        <Route path="/enrollments" element={<EnrollmentsPage />} />
        <Route path="/students/:studentId" element={<p>Profil actif</p>} />
        <Route path="/enrollments/students/:studentId/documents" element={<p>Documents actifs</p>} />
        <Route path="/students/:studentId/history" element={<p>Historique scolaire</p>} />
      </Routes></MemoryRouter>
    </QueryClientProvider>)
    const row = within(await screen.findByRole("table")).getByRole("row", { name: /KONÉ Awa/ })
    const actions = within(row).getByRole("button", { name: /Actions pour KONÉ Awa/ })
    expect(actions).toBeInTheDocument()
    if (yearStatus === "active" && status === "confirmed") {
      fireEvent.keyDown(actions, { key: "ArrowDown" })
      expect(await screen.findByRole("menuitem", { name: "Documents du dossier" })).toBeInTheDocument()
      expect(screen.getByRole("menuitem", { name: "Historique scolaire" })).toBeInTheDocument()
    }
    fireEvent.click(row)
    expect(await screen.findByText(destination)).toBeInTheDocument()
  })

  it("identifie l’année active et limite les anciens dossiers à la consultation", async () => {
    mocks.listSchoolYears.mockResolvedValue([
      { id: "year-old", label: "2025-2026", status: "closed" },
      { id: "year-active", label: "2026-2027", status: "active" },
    ])
    mocks.listEnrollments.mockResolvedValue({
      enrollments: [
        { ...enrollment("old", "Aya"), schoolYearId: "year-old", schoolYearLabel: "2025-2026" },
        { ...enrollment("active", "Awa"), schoolYearId: "year-active", schoolYearLabel: "2026-2027" },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/enrollments"]}><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)

    expect(await screen.findByText("Année active : 2026-2027")).toBeInTheDocument()
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: "year-active" })))
    expect(screen.getByRole("combobox", { name: "Année scolaire" })).toHaveTextContent("2026-2027")
    const table = await screen.findByRole("table")
    const archivedRow = within(table).getByRole("row", { name: /KONÉ Aya/ })
    expect(within(archivedRow).queryByText("2025-2026")).not.toBeInTheDocument()
    expect(within(archivedRow).queryByRole("link", { name: "Modifier" })).not.toBeInTheDocument()
    expect(within(archivedRow).queryByRole("link", { name: "Caisse" })).not.toBeInTheDocument()
    const activeRow = within(table).getByRole("row", { name: /KONÉ Awa/ })
    expect(within(activeRow).getByRole("button", { name: /Actions pour/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Année scolaire" }))
    expect(await screen.findByRole("option", { name: "2026-2027 · Année active" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("option", { name: "2025-2026 · Année clôturée" }))
    expect(await screen.findByText("Dossiers 2025-2026 · consultation seule.")).toBeInTheDocument()
    expect(screen.getByText("Vous consultez une année archivée.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Nouvelle inscription" })).not.toBeInTheDocument()
  })

  it("recharge les classes et remet niveau et classe à zéro lorsque l’année change", async () => {
    mocks.listSchoolYears.mockResolvedValue([
      { id: "year-old", label: "2025-2026", status: "closed" },
      { id: "year-active", label: "2026-2027", status: "active" },
    ])
    mocks.listLevels.mockResolvedValue([{ id: "level-1", name: "6e" }])
    mocks.listClasses.mockResolvedValue({ classes: [{ id: "class-1", name: "6e A", level: { id: "level-1" } }] })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/enrollments"]}><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)

    await screen.findByRole("table")
    const studentSearch = screen.getByRole("searchbox", { name: "Élève, nom ou matricule" })
    fireEvent.change(studentSearch, { target: { value: "Awa" } })
    fireEvent.click(screen.getByRole("combobox", { name: "Niveau" }))
    fireEvent.click(screen.getByRole("option", { name: "6e" }))
    expect(studentSearch).toHaveValue("")
    fireEvent.click(screen.getByRole("combobox", { name: "Classe" }))
    fireEvent.click(screen.getByRole("option", { name: "6e A" }))
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith(expect.objectContaining({
      schoolYearId: "year-active", levelId: "level-1", classId: "class-1",
    })))

    fireEvent.click(screen.getByRole("combobox", { name: "Année scolaire" }))
    fireEvent.click(screen.getByRole("option", { name: "2025-2026 · Année clôturée" }))
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith(expect.objectContaining({
      schoolYearId: "year-old", levelId: undefined, classId: undefined,
    })))
    expect(mocks.listClasses).toHaveBeenCalledWith("year-old")
  })

  it("permet de filtrer la classe de l’année active sans choisir un niveau", async () => {
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: "active" }])
    mocks.listClasses.mockResolvedValue({ classes: [{ id: "class-1", name: "6e A", level: { id: "level-1" } }] })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Classe" })).toBeEnabled())
    fireEvent.click(screen.getByRole("combobox", { name: "Classe" }))
    fireEvent.click(screen.getByRole("option", { name: "6e A" }))
    await waitFor(() => expect(mocks.listEnrollments).toHaveBeenCalledWith(expect.objectContaining({ schoolYearId: "year-1", classId: "class-1" })))
  })

  it("explique le blocage sur toutes les années et rétablit l'année par défaut", async () => {
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-1", label: "2026-2027", status: "active" }])
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/enrollments"]}><EnrollmentsPage /></MemoryRouter>
    </QueryClientProvider>)
    await screen.findByRole("table")
    fireEvent.click(screen.getByRole("combobox", { name: "Année scolaire" }))
    fireEvent.click(screen.getByRole("option", { name: "Toutes les années" }))
    expect(screen.getByRole("combobox", { name: "Niveau" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Niveau" })).toHaveAccessibleDescription("Choisissez une année précise.")
    expect(screen.getByRole("combobox", { name: "Classe" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Classe" })).toHaveAccessibleDescription("Choisissez une année précise.")
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }))
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Année scolaire" })).toHaveTextContent("2026-2027"))
    expect(screen.queryByRole("button", { name: "Réinitialiser les filtres" })).not.toBeInTheDocument()
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

    await waitFor(() => expect(within(screen.getByRole("table")).getByText("KONÉ Adjoua")).toBeInTheDocument())
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("ouvre l’historique depuis la campagne active sélectionnée automatiquement", async () => {
    mocks.listSchoolYears.mockResolvedValue([{ id: "year-older", label: "2025-2026", status: "closed", endDate: "2026-06-30" }, { id: "year-1", label: "2026-2027", status: "closed", endDate: "2027-06-30" }, { id: "year-active", label: "2027-2028", status: "active", startDate: "2027-09-01" }])
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

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Réinscriptions" }), { button: 0 })

    expect(await screen.findByText(/Matricule : MAT-001/)).toBeInTheDocument()
    expect(screen.getByLabelText("Année d’origine clôturée")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Année d’origine clôturée" })).toHaveTextContent("2026-2027")
    expect(screen.getByLabelText("Niveau récent")).toBeInTheDocument()
    expect(screen.getByLabelText("Classe récente")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Voir dossier" }))
    expect(await screen.findByText("Dossier complet de l’élève")).toBeInTheDocument()
    await waitFor(() => expect(mocks.listReEnrollmentCandidates).toHaveBeenCalledWith({
      schoolYearId: "year-active", campaignStatus: "to_process", sourceSchoolYearId: "year-1", levelId: undefined, classId: undefined, search: undefined, page: 1, limit: 20,
    }))
  })
})
