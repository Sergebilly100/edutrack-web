import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchRecoveryYears: vi.fn(), fetchRecoverySummary: vi.fn(), fetchRecoveryStudents: vi.fn(),
}))
vi.mock("../finance.api", () => ({
  fetchRecoveryYears: mocks.fetchRecoveryYears,
  fetchRecoverySummary: mocks.fetchRecoverySummary,
  fetchRecoveryStudents: mocks.fetchRecoveryStudents,
}))
vi.mock("@/shared/components/OfflineIndicator", () => ({ OfflineIndicator: () => null }))

import RecoveryPage from "../RecoveryPage"

const metrics = { studentCount: 1, expected: 100000, paid: 30000, remaining: 70000, recoveryRate: 0.3, studentsToFollow: 1 }
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

const renderPage = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RecoveryPage /></QueryClientProvider></MemoryRouter>)

describe("RecoveryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    mocks.fetchRecoveryYears.mockResolvedValue([{ id: "year", label: "2026-2027", status: "active" }])
    mocks.fetchRecoverySummary.mockImplementation(summaryFor)
    mocks.fetchRecoveryStudents.mockResolvedValue({ students: [{ studentId: "student-1", name: "Awa Koné", matricule: "MAT-1", status: "late", expected: 100000, paid: 30000, remaining: 70000, daysLate: 4 }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  })

  it("clears the selected class when the level changes and opens a paged student detail", async () => {
    renderPage()
    expect(await screen.findByText("6e A")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "6e" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Classe" }))
    fireEvent.click(await screen.findByRole("option", { name: "6e A" }))
    await waitFor(() => expect(mocks.fetchRecoverySummary).toHaveBeenCalledWith("year", "level-a", "class-a"))
    fireEvent.click(screen.getByRole("button", { name: "Voir les élèves de 6e A" }))
    expect(await screen.findByText("Awa Koné")).toBeInTheDocument()
    expect(mocks.fetchRecoveryStudents).toHaveBeenCalledWith("year", "class-a", "level-a", 1)
    fireEvent.click(screen.getByRole("combobox", { name: "Niveau" }))
    fireEvent.click(await screen.findByRole("option", { name: "5e" }))
    await waitFor(() => expect(mocks.fetchRecoverySummary).toHaveBeenCalledWith("year", "level-b", undefined))
    expect(screen.queryByText("Awa Koné")).not.toBeInTheDocument()
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
