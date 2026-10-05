import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ students: vi.fn(), cards: vi.fn() }))
vi.mock("../parent.api", () => ({
  listParentStudents: api.students,
  listParentReportCards: api.cards,
  requestParentReportCardPdf: vi.fn(),
}))

import ParentReportCardsPage from "../ParentReportCardsPage"

const students = [
  { id: "aya", first_name: "Aya", last_name: "Recette", class_name: "QA" },
  { id: "yao", first_name: "Yao", last_name: "Recette", class_name: "QB" },
]
const years = [
  { id: "recent", label: "2026-2027" },
  { id: "old", label: "2025-2026" },
]
const card = (id: string, yearId: string, average: number) => ({
  id, periodLabel: "Trimestre 1", schoolYearId: yearId,
  schoolYearLabel: years.find((year) => year.id === yearId)?.label ?? "2026-2027",
  generalAverage: average, rank: 1, classHeadcount: 2, publishedAt: "2026-10-01",
})
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } })
const choose = async (name: string, option: string) => {
  fireEvent.click(await screen.findByRole("combobox", { name }))
  fireEvent.click(screen.getByRole("option", { name: option }))
}

afterEach(() => {
  api.students.mockReset()
  api.cards.mockReset()
})

it("reconsulte les bulletins publiés à l'ouverture même si le cache récent était vide", async () => {
  api.students.mockResolvedValue([students[0]])
  api.cards.mockImplementation(async (_studentId: string, yearId?: string) => ({
    reportCards: yearId ? [card("bulletin", "recent", 16.4)] : [],
    availableSchoolYears: [years[0]], inRevision: false,
  }))
  const queryClient = client()
  queryClient.setQueryData(["parent", "students"], [students[0]])
  queryClient.setQueryData(["parent", "report-cards", "aya", "years"], {
    reportCards: [], availableSchoolYears: [years[0]], inRevision: false,
  })
  const view = render(<QueryClientProvider client={queryClient}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    expect(await screen.findByText("16.40/20")).toBeInTheDocument()
    expect(api.cards).toHaveBeenCalledWith("aya", "recent")
    expect(screen.queryByText("Aucun bulletin publié")).not.toBeInTheDocument()
  } finally {
    view.unmount()
    queryClient.clear()
  }
})

it("filtre par année, isole le cache et reprend l'année récente au changement d'enfant", async () => {
  api.students.mockResolvedValue(students)
  api.cards.mockImplementation(async (studentId: string, yearId?: string) => {
    if (studentId === "aya") return {
      reportCards: yearId === "recent" ? [card("aya-recent", "recent", 17)]
        : yearId === "old" ? [card("aya-old", "old", 13)] : [],
      availableSchoolYears: years, inRevision: false,
    }
    return {
      reportCards: yearId === "old" ? [card("yao-old", "old", 11)] : [],
      availableSchoolYears: [years[1]], inRevision: false,
    }
  })
  const queryClient = client()
  const view = render(<QueryClientProvider client={queryClient}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    await choose("Enfant", "Aya Recette · QA")
    expect(await screen.findByText("17.00/20")).toBeInTheDocument()
    await choose("Année scolaire", "2025-2026")
    expect(await screen.findByText("13.00/20")).toBeInTheDocument()
    expect(screen.queryByText("17.00/20")).not.toBeInTheDocument()
    expect(queryClient.getQueryData(["parent", "report-cards", "aya", "recent"])).toBeDefined()
    expect(queryClient.getQueryData(["parent", "report-cards", "aya", "old"])).toBeDefined()

    await choose("Enfant", "Yao Recette · QB")
    expect(await screen.findByText("11.00/20")).toBeInTheDocument()
    expect(api.cards).toHaveBeenCalledWith("yao", "old")
    expect(screen.queryByText("13.00/20")).not.toBeInTheDocument()

    await choose("Enfant", "Aya Recette · QA")
    expect(await screen.findByText("17.00/20")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Année scolaire" })).toHaveTextContent("2026-2027")
  } finally {
    view.unmount()
    queryClient.clear()
  }
})

it("distingue année vide, révision et erreur de chargement", async () => {
  api.students.mockResolvedValue([students[0]])
  api.cards.mockImplementation(async (_studentId: string, yearId?: string) => ({
    reportCards: [], availableSchoolYears: years, inRevision: yearId === "old",
  }))
  const queryClient = client()
  const view = render(<QueryClientProvider client={queryClient}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    expect(await screen.findByText("Aucun bulletin publié")).toBeInTheDocument()
    await choose("Année scolaire", "2025-2026")
    expect(await screen.findByText("Bulletin en révision")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /télécharger/i })).not.toBeInTheDocument()
  } finally {
    view.unmount()
    queryClient.clear()
  }

  api.cards.mockRejectedValue(new Error("offline"))
  const errorClient = client()
  const errorView = render(<QueryClientProvider client={errorClient}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les bulletins"))
  } finally {
    errorView.unmount()
    errorClient.clear()
  }
})

it("affiche l'état vide sans sélecteur quand aucun bulletin n'est publié", async () => {
  api.students.mockResolvedValue([students[0]])
  api.cards.mockResolvedValue({ reportCards: [], availableSchoolYears: [], inRevision: false })
  const queryClient = client()
  const view = render(<QueryClientProvider client={queryClient}><ParentReportCardsPage /></QueryClientProvider>)
  try {
    expect(await screen.findByText("Aucun bulletin publié")).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Année scolaire" })).not.toBeInTheDocument()
    expect(api.cards).toHaveBeenCalledWith("aya")
    expect(api.cards).toHaveBeenCalledTimes(1)
  } finally {
    view.unmount()
    queryClient.clear()
  }
})
