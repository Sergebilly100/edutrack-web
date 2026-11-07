import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchRecoveryYears: vi.fn(), fetchRecoverySummary: vi.fn(), fetchRecoveryStudents: vi.fn(),
  permissions: new Set<string>(["payments.view"]),
  labels: { singular: "Élève", plural: "Élèves", singularLower: "élève", pluralLower: "élèves" },
}))
vi.mock("../finance.api", () => ({
  fetchRecoveryYears: mocks.fetchRecoveryYears,
  fetchRecoverySummary: mocks.fetchRecoverySummary,
  fetchRecoveryStudents: mocks.fetchRecoveryStudents,
}))
vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))
vi.mock("@/shared/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: (key: string) => mocks.permissions.has(key) }) }))
vi.mock("@/shared/hooks/useStudentLabel", () => ({ useStudentLabels: () => mocks.labels }))

import RecoveryPage from "../RecoveryPage"

const metrics = { studentCount: 2, expected: 100000, paid: 30000, remaining: 70000, recoveryRate: 0.3, studentsToFollow: 1 }
const classA = { ...metrics, classId: "class-a", className: "6e A", levelId: "level-a", levelName: "6e" }
const classB = { ...metrics, classId: "class-b", className: "5e B", levelId: "level-b", levelName: "5e" }
const allClasses = [classA, classB]
const summaryFor = (_year: string, level?: string, schoolClass?: string) => {
  const classes = allClasses.filter((item) => (!level || item.levelId === level) && (!schoolClass || item.classId === schoolClass))
  return {
    schoolYearId: "year", school: metrics, selection: classes.length ? metrics : { ...metrics, studentCount: 0 },
    levels: classes.map((item) => ({ ...metrics, levelId: item.levelId, levelName: item.levelName })), classes,
  }
}
const students = [
  { studentId: "s1", name: "Awa Koné", matricule: "MAT-1", status: "late", expected: 100000, paid: 30000, remaining: 70000, daysLate: 4 },
  { studentId: "s2", name: "Mariam Bamba", matricule: "MAT-2", status: "up_to_date", expected: 100000, paid: 100000, remaining: 0, daysLate: null },
  { studentId: "s3", name: "Nadia Diabaté", matricule: "MAT-3", status: "late", expected: 100000, paid: 0, remaining: 100000, daysLate: 1 },
]

const renderPage = () => render(<MemoryRouter initialEntries={["/finance/recovery"]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Routes><Route path="/finance/recovery" element={<RecoveryPage />} /><Route path="/finance/history/:studentId" element={<p>Dossier élève</p>} /></Routes></QueryClientProvider></MemoryRouter>)

const tableView = (name: string) => within(screen.getByRole("table")).getByRole("button", { name: `Voir les élèves de ${name}` })
const findView = async (name: string) => { await screen.findByRole("table"); return tableView(name) }

describe("RecoveryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.permissions = new Set(["payments.view"])
    mocks.labels = { singular: "Élève", plural: "Élèves", singularLower: "élève", pluralLower: "élèves" }
    Element.prototype.scrollIntoView = vi.fn()
    mocks.fetchRecoveryYears.mockResolvedValue([{ id: "year", label: "2026-2027", status: "active" }])
    mocks.fetchRecoverySummary.mockImplementation(summaryFor)
    mocks.fetchRecoveryStudents.mockResolvedValue({ students, pagination: { page: 1, limit: 100, total: 3, totalPages: 1 } })
  })

  it("renders one table with a total row and the configured follow-up header", async () => {
    mocks.labels = { singular: "Étudiant(e)", plural: "Étudiants", singularLower: "étudiant(e)", pluralLower: "étudiants" }
    renderPage()
    expect(await screen.findByRole("columnheader", { name: "À suivre (étudiants)" })).toBeInTheDocument()
    expect(screen.getAllByRole("table")).toHaveLength(1)
    expect(within(screen.getByRole("table")).getByText("Total")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Attendu" })).toHaveClass("text-right")
  })

  it("defaults to « À suivre (élèves) » and expands a level on demand", async () => {
    renderPage()
    expect(await screen.findByRole("columnheader", { name: "À suivre (élèves)" })).toBeInTheDocument()
    const first = within(screen.getByRole("table")).getByRole("button", { name: /^6e/ })
    expect(first).toHaveAttribute("aria-expanded", "true")
    expect(tableView("6e A")).toBeInTheDocument()
    expect(within(screen.getByRole("table")).queryByRole("button", { name: "Voir les élèves de 5e B" })).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /^5e/ }))
    expect(tableView("5e B")).toBeInTheDocument()
  })

  it("clears the selected class when the level changes", async () => {
    renderPage()
    await screen.findByRole("columnheader", { name: "Attendu" })
    fireEvent.click(screen.getByRole("combobox", { name: "Niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6e" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Classe" }))
    fireEvent.click(await screen.findByRole("option", { name: "6e A" }))
    await waitFor(() => expect(mocks.fetchRecoverySummary).toHaveBeenCalledWith("year", "level-a", "class-a"))
    fireEvent.click(screen.getByRole("combobox", { name: "Niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "5e" }))
    await waitFor(() => expect(mocks.fetchRecoverySummary).toHaveBeenCalledWith("year", "level-b", undefined))
  })

  it("opens the students dialog, filters, searches and closes with Escape", async () => {
    renderPage()
    const trigger = await findView("6e A")
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: "Élèves de 6e A" })
    expect(await within(dialog).findByText("Awa Koné")).toBeInTheDocument()
    expect(within(dialog).getByText("1 jour de retard")).toBeInTheDocument()
    expect(within(dialog).getByText("4 jours de retard")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Tous · 3" })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "À jour · 1" }))
    expect(within(dialog).queryByText("Awa Koné")).not.toBeInTheDocument()
    expect(within(dialog).getByText("Mariam Bamba")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Tous · 3" }))
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "mat-3" } })
    expect(within(dialog).getByText("Nadia Diabaté")).toBeInTheDocument()
    expect(within(dialog).queryByText("Awa Koné")).not.toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("closes with the Fermer button", async () => {
    renderPage()
    fireEvent.click(await findView("6e A"))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Fermer" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("links student rows to their financial file only with payments.view", async () => {
    renderPage()
    fireEvent.click(await findView("6e A"))
    expect(await screen.findByRole("link", { name: /Awa Koné/ })).toHaveAttribute("href", expect.stringContaining("/finance/history/s1"))
  })

  it("does not make student rows clickable without payments.view", async () => {
    mocks.permissions = new Set()
    renderPage()
    fireEvent.click(await findView("6e A"))
    expect(await screen.findByText("Awa Koné")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Awa Koné/ })).not.toBeInTheDocument()
  })

  it("shows an error with retry and an empty state inside the dialog", async () => {
    mocks.fetchRecoveryStudents.mockRejectedValueOnce(new Error("offline"))
    renderPage()
    fireEvent.click(await findView("6e A"))
    expect(await screen.findByText(/Impossible de charger les élèves de cette classe/)).toBeInTheDocument()
    mocks.fetchRecoveryStudents.mockResolvedValue({ students: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })
    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }))
    expect(await screen.findByText("Aucun élève dans cette sélection")).toBeInTheDocument()
  })

  it("shows an explicit empty state", async () => {
    mocks.fetchRecoverySummary.mockResolvedValue({ schoolYearId: "year", school: metrics, selection: { ...metrics, studentCount: 0 }, levels: [], classes: [] })
    renderPage()
    expect(await screen.findByText("Aucune inscription confirmée")).toBeInTheDocument()
  })

  it("shows a load error with a retry action", async () => {
    mocks.fetchRecoverySummary.mockRejectedValue(new Error("offline"))
    renderPage()
    expect(await screen.findByText("Impossible de charger le recouvrement.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument()
  })
})
