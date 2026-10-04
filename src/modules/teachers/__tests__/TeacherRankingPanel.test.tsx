import { render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TeacherRankingPanel } from "../TeachersPage"
import { getTeacherCompliance, getTeachers, type TeacherListItem } from "../teachers.api"

vi.mock("../teachers.api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../teachers.api")>(),
  getTeacherCompliance: vi.fn(),
  getTeachers: vi.fn(),
}))

vi.mock("@/shared/hooks/useStudentLabel", () => ({
  useStudentLabels: () => ({ singularLower: "élève", pluralLower: "élèves" }),
}))

const teachers = [
  { id: "sans-cours", subjects: ["Maths"] },
  { id: "partiel", subjects: ["Maths"] },
  { id: "sans-pointage", subjects: ["Maths"] },
] as TeacherListItem[]

const compliance = [
  { teacherId: "sans-cours", teacherName: "A Sans cours", totalScheduled: 0, hasScheduledLessons: false,
    totalCheckins: 0, totalCheckouts: 0, complianceRate: 100, scanEndRate: 100,
    roomCorrectRate: 100, rollcallRate: 100, attendanceRate: 100, rank: 1 },
  { teacherId: "partiel", teacherName: "B Partiel", totalScheduled: 2, hasScheduledLessons: true,
    totalCheckins: 1, totalCheckouts: 1, complianceRate: 60, scanEndRate: 100,
    roomCorrectRate: 50, rollcallRate: 50, attendanceRate: 50, rank: 2 },
  { teacherId: "sans-pointage", teacherName: "C Sans pointage", totalScheduled: 1, hasScheduledLessons: true,
    totalCheckins: 0, totalCheckouts: 0, complianceRate: 0, scanEndRate: 0,
    roomCorrectRate: 0, rollcallRate: 0, attendanceRate: 0, rank: 3 },
]

describe("TeacherRankingPanel", () => {
  beforeEach(() => {
    vi.mocked(getTeachers).mockResolvedValue({
      data: teachers,
      pagination: { page: 1, limit: 200, total: teachers.length, totalPages: 1 },
    })
    vi.mocked(getTeacherCompliance).mockResolvedValue(compliance)
  })

  it("explique le 100 % sans cours, garde les autres scores et utilise le taux corrigé dans les statistiques", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><TeacherRankingPanel teachers={teachers} /></QueryClientProvider>)

    const unscheduled = await screen.findByTestId("ranking-row-sans-cours")
    expect(within(unscheduled).getByText("Aucun cours programmé ce mois")).toBeInTheDocument()
    expect(within(unscheduled).getAllByText(/100%/)).toHaveLength(5)
    for (const label of ["Présence 100%", "Scan fin 100%", "Salle correcte 100%", "Pointage élève 100%"]) {
      expect(within(unscheduled).getByText(label)).toHaveClass("bg-muted")
      expect(within(unscheduled).getByText(label)).not.toHaveClass("border-red-200")
    }

    const partial = screen.getByTestId("ranking-row-partiel")
    expect(within(partial).getByText("60%")).toBeInTheDocument()
    expect(within(partial).queryByText("Aucun cours programmé ce mois")).not.toBeInTheDocument()
    const missing = screen.getByTestId("ranking-row-sans-pointage")
    expect(within(missing).getByText("0%", { selector: "span.font-semibold" })).toBeInTheDocument()
    expect(within(missing).getByText("Présence 0%")).toHaveClass("border-red-200")
    expect(screen.getByText("Meilleur taux").parentElement).toHaveTextContent("100%")
    expect(screen.getByText("Moyenne").parentElement).toHaveTextContent("53%")
    const rows = screen.getAllByTestId(/^ranking-row-/)
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "ranking-row-sans-cours", "ranking-row-partiel", "ranking-row-sans-pointage",
    ])
    await waitFor(() => expect(getTeachers).toHaveBeenCalled())
  })
})
