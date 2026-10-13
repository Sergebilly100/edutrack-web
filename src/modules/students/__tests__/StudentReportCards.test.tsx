import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { StudentReportCards } from "../components/StudentReportCards"

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock("../students.api", () => ({
  listStudentReportCards: api.list,
  getStudentReportCard: api.detail,
  requestStudentReportCardPdf: vi.fn(),
}))

it("affiche le rang général, l'effectif et les rangs par matière du dossier élève", async () => {
  api.list.mockResolvedValue([{
    id: "card-1", periodLabel: "Trimestre 1", schoolYearId: "year-1",
    schoolYearLabel: "2026-2027", className: "6ème A", generalAverage: 16,
    rank: 1, classHeadcount: 30,
  }])
  api.detail.mockResolvedValue({
    id: "card-1", periodLabel: "Trimestre 1", className: "6ème A", generalAverage: 16,
    rank: 1, classHeadcount: 30, status: "published",
    lines: [
      { id: "line-1", subjectName: "Mathématiques", lineType: "subject", average: 16, coefficient: 4, rank: 1 },
      { id: "line-2", subjectName: "Français", lineType: "subject", average: 14, coefficient: 2, rank: 2 },
      { id: "line-3", subjectName: null, lineType: "conduct", average: 17, coefficient: 2, rank: null },
    ],
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><StudentReportCards studentId="student-1" schoolYearId="year-1" /></QueryClientProvider>)

  expect(await screen.findByText("1er / 30")).toHaveAttribute("aria-label", "Rang : 1er sur 30")
  fireEvent.click(screen.getByRole("button", { name: "Consulter" }))
  expect(await screen.findByText("Mathématiques")).toBeInTheDocument()
  expect(screen.getAllByText("1er / 30")).toHaveLength(2)
  expect(screen.getByRole("cell", { name: "Rang : 1er" })).toHaveTextContent("1er")
  expect(screen.getByRole("cell", { name: "Rang : 2ème" })).toHaveTextContent("2ème")
  expect(screen.getByRole("cell", { name: "Rang : non renseigné" })).toHaveTextContent("-")
})
