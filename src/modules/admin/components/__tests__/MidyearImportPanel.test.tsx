import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ getMidyearMappingProfile: vi.fn(), analyzeMidyearImport: vi.fn(),
  saveMidyearMappingProfile: vi.fn(), confirmMidyearImport: vi.fn(), previewMidyearImport: vi.fn(), getSchoolYearStatus: vi.fn() }))
vi.mock("@/modules/admin/admin.api", () => api)
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { MidyearImportPanel } from "../MidyearImportPanel"

const fields = [
  { sourceColumnLabel: "Libellé", targetField: "nom", isRequired: true, translations: [] },
  { sourceColumnLabel: "Position", targetField: "ordre", isRequired: false, translations: [] },
]
const file = new File(["xlsx"], "niveaux.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
const setup = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MidyearImportPanel tenantId="tenant-1" schoolName="École C8" /></QueryClientProvider>)
const selectYear = async () => {
  fireEvent.click(await screen.findByRole("combobox", { name: "Année scolaire concernée" }))
  fireEvent.click(await screen.findByRole("option", { name: "2026-2027" }))
}
const analyze = async () => {
  await selectYear()
  fireEvent.change(screen.getByLabelText(/Fichier Excel/), { target: { files: [file] } })
  fireEvent.click(screen.getByRole("button", { name: "Analyser les colonnes" }))
  await screen.findByText("Correspondance des colonnes")
}
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  api.getSchoolYearStatus.mockResolvedValue({ activeYear: { id: "year-1", label: "2026-2027" } })
  api.getMidyearMappingProfile.mockResolvedValue(null)
  api.analyzeMidyearImport.mockResolvedValue({ headers: ["Libellé", "Position"], rowCount: 2, matchedFields: fields, missingTargets: ["nom"], profile: null, distinctValuesByColumn: {} })
  api.saveMidyearMappingProfile.mockResolvedValue({ id: "profile-1", importType: "midyear_levels", fields })
  api.previewMidyearImport.mockResolvedValue({ schoolYearId: "year-1", validRows: [{ rowNumber: 2, values: { nom: "6e", ordre: "1" } }], errors: [{ rowNumber: 3, reason: "Niveau ambigu" }], totalRows: 2,
    impact: { profilesCreated: 1, profilesReused: 0, classesCreated: 1, classesReused: 0, enrollmentsCreated: 1, enrollmentsReused: 0, paymentsCreated: 0, paymentsReused: 0 }, classesWithoutTeacherAssignments: 1, previewToken: "signed-preview" })
  api.confirmMidyearImport.mockResolvedValue({ createdCount: 1, reusedCount: 0, errors: [], totalRows: 2 })
})
describe("MidyearImportPanel", () => {
  it("requires the year before file analysis and stores the mapping before preview", async () => {
    setup()
    expect(screen.getByLabelText(/Fichier Excel/)).toBeDisabled()
    expect(screen.getByRole("button", { name: "Analyser les colonnes" })).toBeDisabled()
    await analyze()
    expect(api.analyzeMidyearImport).toHaveBeenCalledWith("tenant-1", "levels", file, "year-1")
    expect(screen.getByRole("button", { name: "Lancer l’import définitif" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Prévisualiser la reprise" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les correspondances" }))
    await waitFor(() => expect(api.saveMidyearMappingProfile).toHaveBeenCalledWith("tenant-1", "levels", expect.objectContaining({ label: "niveaux.xlsx", fields })))
    await waitFor(() => expect(screen.getByRole("button", { name: "Prévisualiser la reprise" })).toBeEnabled())
  })
  it("shows impact and every row error, then requires impact acceptance before submitting the signed preview", async () => {
    setup(); await analyze()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les correspondances" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Prévisualiser la reprise" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Prévisualiser la reprise" }))
    await screen.findByText("Impact avant confirmation")
    expect(screen.getByText("Niveau ambigu")).toBeVisible()
    expect(screen.getByText(/sans affectation professeur/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Lancer l’import définitif" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Lancer l’import définitif" }))
    await waitFor(() => expect(api.confirmMidyearImport).toHaveBeenCalledWith("tenant-1", "levels", file, "year-1", "signed-preview"))
    await screen.findByText(/Reprise terminée/)
    expect(screen.queryByText("Impact avant confirmation")).not.toBeInTheDocument()
  })
  it("disallows confirmation when every row is invalid", async () => {
    api.previewMidyearImport.mockResolvedValue({ validRows: [], errors: [{ rowNumber: 2, reason: "Matricule ambigu" }], impact: { profilesCreated: 0, profilesReused: 0, classesCreated: 0, classesReused: 0, enrollmentsCreated: 0, enrollmentsReused: 0, paymentsCreated: 0, paymentsReused: 0 }, classesWithoutTeacherAssignments: 0 })
    setup(); await analyze()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les correspondances" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Prévisualiser la reprise" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Prévisualiser la reprise" }))
    await screen.findByText("Aucune ligne valide")
    expect(screen.getByRole("checkbox")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Lancer l’import définitif" })).toBeDisabled()
    expect(api.confirmMidyearImport).not.toHaveBeenCalled()
  })
  it("requires opening a school year when none is active", async () => {
    api.getSchoolYearStatus.mockResolvedValue({ activeYear: null })
    setup(); await screen.findByText("Aucune année scolaire active")
    expect(screen.getByLabelText(/Fichier Excel/)).toBeDisabled()
    expect(api.analyzeMidyearImport).not.toHaveBeenCalled()
  })
})

it("C10 exposes teacher data imports, reports values, and keeps the homeroom reminder nonblocking after confirmation", async () => {
  const assignmentFields = ["matricule", "matiere", "classes"].map((targetField, index) => ({ targetField, sourceColumnLabel: ["Matricule", "Matière", "Classes"][index], isRequired: true, translations: [] }))
  api.analyzeMidyearImport.mockResolvedValue({ headers: ["Matricule", "Matière", "Classes"], rowCount: 2, matchedFields: assignmentFields, missingTargets: [], profile: { fields: assignmentFields }, distinctValuesByColumn: {} })
  api.previewMidyearImport.mockResolvedValue({ validRows: [{ rowNumber: 2, values: { matricule: "P-001", matiere: "Mathématiques", classes: "4e A, 2nde C" } }], errors: [{ rowNumber: 3, column: "Classes", value: "absente", reason: "Classe inconnue" }], impact: { assignmentsCreated: 2 }, classesWithoutTeacherAssignments: 0, classesWithoutHomeroomTeacher: [{ id: "4a", name: "4e A" }], previewToken: "signed" })
  api.confirmMidyearImport.mockResolvedValue({ createdCount: 1, reusedCount: 0, errors: [], classesWithoutHomeroomTeacher: [{ id: "4a", name: "4e A" }] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MidyearImportPanel tenantId="tenant-1" schoolName="École A" teachersOnly /></QueryClientProvider>)
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Année scolaire concernée" })).toBeEnabled())
  fireEvent.click(screen.getByRole("combobox", { name: "Année scolaire concernée" }))
  fireEvent.click(await screen.findByRole("option", { name: "2026-2027" }))
  fireEvent.change(screen.getByLabelText(/Fichier Excel/), { target: { files: [file] } })
  fireEvent.click(screen.getByRole("button", { name: "Analyser les colonnes" }))
  await screen.findByText("Correspondance des colonnes")
  expect(api.analyzeMidyearImport).toHaveBeenCalledWith("tenant-1", "teacher_assignments", file, "year-1")
  fireEvent.click(screen.getByRole("button", { name: "Prévisualiser la reprise" }))
  await screen.findByText("Impact avant confirmation")
  expect(screen.getByText("absente", { exact: true })).toBeVisible()
  expect(screen.getByText(/Rappel : classes sans professeur principal/)).toBeVisible()
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByRole("button", { name: "Lancer l’import définitif" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "Lancer l’import définitif" }))
  await screen.findByText(/Reprise terminée/)
  expect(screen.getByText(/Rappel : classes sans professeur principal/)).toBeVisible()
})
