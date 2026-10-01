import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { decisionWorkspace, teacherActions } = vi.hoisted(() => ({ decisionWorkspace: vi.fn(), teacherActions: vi.fn() }))
vi.mock("@/modules/academic/academic.api", () => ({
  fetchConductDecisionWorkspace: () => decisionWorkspace(),
  fetchConductTeacherActions: () => teacherActions(),
}))
vi.mock("@/modules/academic/NotesPage", () => ({ default: () => <div>Évaluations disponibles</div> }))
vi.mock("@/modules/academic/TeacherAveragesPage", () => ({ default: () => <div>Moyennes disponibles</div> }))
vi.mock("@/modules/academic/ConductPage", () => ({ default: () => <div>Avis disponibles</div> }))
vi.mock("@/modules/academic/ConductDecisionWorkspace", () => ({ default: () => <div>Décisions disponibles</div> }))

import TeacherNotesWorkspace from "@/modules/academic/TeacherNotesWorkspace"

function renderWorkspace(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { client, ...render(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={client}>
    <TeacherNotesWorkspace />
  </QueryClientProvider></MemoryRouter>) }
}

const activeScope = { classId: "c1", schoolYearStatus: "active", reviewOpen: true, isClosed: false, studentCount: 1, pendingCount: 1 }

describe("TeacherNotesWorkspace", () => {
  beforeEach(() => teacherActions.mockResolvedValue({ teacherActions: [] }))
  afterEach(() => { decisionWorkspace.mockReset(); teacherActions.mockReset() })

  it("garde Évaluations, Moyennes et Conduite utilisables si la politique échoue", async () => {
    decisionWorkspace.mockRejectedValue(new Error("policy unavailable"))
    renderWorkspace("/academic/notes")
    expect(screen.getByText("Évaluations disponibles")).toBeInTheDocument()
    cleanup()
    renderWorkspace("/academic/notes?tab=moyennes")
    expect(screen.getByText("Moyennes disponibles")).toBeInTheDocument()
    cleanup()
    renderWorkspace("/academic/notes?tab=conduite")
    expect(screen.getByText("Avis disponibles")).toBeInTheDocument()
    await waitFor(() => expect(decisionWorkspace).toHaveBeenCalled())
    expect(screen.queryByRole("tab", { name: "Décisions" })).not.toBeInTheDocument()
  })

  it("explique l’échec d’une URL Décisions et propose un réessai", async () => {
    decisionWorkspace.mockRejectedValue(new Error("policy unavailable"))
    renderWorkspace("/academic/notes?tab=decisions")
    expect(screen.getByText("Avis disponibles")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeInTheDocument()
    expect(screen.queryByText("Décisions disponibles")).not.toBeInTheDocument()
  })

  it("affiche Décisions après confirmation de la portée serveur", async () => {
    decisionWorkspace.mockResolvedValue({ decisionScopes: [activeScope], decisionActions: [] })
    teacherActions.mockResolvedValue({ teacherActions: [{ pendingCount: 2 }] })
    renderWorkspace("/academic/notes?tab=decisions")
    expect(await screen.findByText("Décisions disponibles")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Décisions" })).toBeInTheDocument()
    expect(await screen.findByRole("tab", { name: "Conduite 2" })).toBeInTheDocument()
  })

  it("retire Décisions après le passage de la politique à Direction", async () => {
    decisionWorkspace.mockResolvedValueOnce({ decisionScopes: [activeScope], decisionActions: [] })
      .mockResolvedValue({ decisionScopes: [], decisionActions: [] })
    teacherActions.mockResolvedValue({ teacherActions: [] })
    const { client } = renderWorkspace("/academic/notes?tab=decisions")
    expect(await screen.findByText("Décisions disponibles")).toBeInTheDocument()
    await client.invalidateQueries({ queryKey: ["conduct", "decision-workspace"] })
    expect(await screen.findByText("Avis disponibles")).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Décisions" })).not.toBeInTheDocument()
  })
})
