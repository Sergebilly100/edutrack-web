import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ students: vi.fn(), cards: vi.fn() }))
vi.mock("../parent.api", () => ({
  listParentStudents: api.students,
  listParentReportCards: api.cards,
  requestParentReportCardPdf: vi.fn(),
}))

import ParentReportCardsPage from "../ParentReportCardsPage"

it("reconsulte les bulletins publiés à l'ouverture même si le cache récent était vide", async () => {
  const students = [{ id: "aya", first_name: "Aya", last_name: "Recette", class_name: "QA" }]
  api.students.mockResolvedValue(students)
  api.cards.mockResolvedValue({ reportCards: [{ id: "bulletin", periodLabel: "Trimestre QA", schoolYearLabel: "QA 2026", generalAverage: 16.4, rank: 1, classHeadcount: 2 }], inRevision: false })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } })
  client.setQueryData(["parent", "students"], students)
  client.setQueryData(["parent", "report-cards", "aya"], [])
  const view = render(<QueryClientProvider client={client}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    expect(await screen.findByText("16.40/20")).toBeInTheDocument()
    expect(api.cards).toHaveBeenCalledWith("aya")
    expect(screen.queryByText("Aucun bulletin publié")).not.toBeInTheDocument()
  } finally {
    view.unmount()
    client.clear()
  }
})

it("masque le bulletin invalidé et ne révèle pas le motif de la réclamation", async () => {
  api.students.mockResolvedValue([{ id: "aya", first_name: "Aya", last_name: "Recette", class_name: "QA" }])
  api.cards.mockResolvedValue({ reportCards: [], inRevision: true })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    expect(await screen.findByText("Bulletin en révision")).toBeInTheDocument()
    expect(screen.queryByText(/note publiée est incorrecte/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /télécharger/i })).not.toBeInTheDocument()
  } finally {
    view.unmount()
    client.clear()
  }
})
