import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

const getStudentYearResults = vi.hoisted(() => vi.fn())
vi.mock("@/modules/students/students.api", () => ({ getStudentYearResults }))
import { StudentYearResults } from "../components/StudentYearResults"

describe("StudentYearResults", () => {
  it("présente uniquement les notes demandées pour l’année sélectionnée", async () => {
    getStudentYearResults.mockResolvedValue({
      studentId: "student-1", schoolYearId: "year-2025",
      evaluations: [{ id: "evaluation-1", periodLabel: "Trimestre 1", subjectName: "Mathématiques", label: "Devoir 1", score: 15, maxScore: 20, coefficient: 2 }],
      averages: [{ id: "average-1", periodLabel: "Trimestre 1", subjectName: null, average: 14, rank: 3 }],
      conduct: [{ id: "conduct-1", periodLabel: "Trimestre 1", note: 16, coefficient: 1 }],
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentYearResults studentId="student-1" schoolYearId="year-2025" schoolYearLabel="2025-2026" />
    </QueryClientProvider>)
    expect(await screen.findByText("Devoir 1")).toBeInTheDocument()
    expect(screen.getByText("Moyenne générale")).toBeInTheDocument()
    expect(screen.getByText("16/20")).toBeInTheDocument()
    expect(getStudentYearResults).toHaveBeenCalledWith("student-1", "year-2025")
  })
})
