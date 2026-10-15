import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
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

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.search}</span>
}

function renderWorkspace(url: string, cachedActions?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (cachedActions) client.setQueryData(["conduct", "teacher-actions"], cachedActions)
  return { client, ...render(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={client}>
    <TeacherNotesWorkspace /><LocationProbe />
  </QueryClientProvider></MemoryRouter>) }
}

const activeScope = { classId: "c1", schoolYearStatus: "active", reviewOpen: true, isClosed: false, studentCount: 1, pendingCount: 1 }
const teacherScope = { classId: "c1", className: "6e A", gradingPeriodId: "p1", gradingPeriodLabel: "T1", endDate: "2026-12-20", pendingCount: 0 }

describe("TeacherNotesWorkspace", () => {
  beforeEach(() => teacherActions.mockResolvedValue({ teacherOpenScopes: [], teacherActions: [] }))
  afterEach(() => { decisionWorkspace.mockReset(); teacherActions.mockReset() })

  it("masque Conduite sans portée même si la politique de décision échoue", async () => {
    decisionWorkspace.mockRejectedValue(new Error("policy unavailable"))
    renderWorkspace("/academic/notes")
    expect(screen.getByText("Évaluations disponibles")).toBeInTheDocument()
    cleanup()
    renderWorkspace("/academic/notes?tab=moyennes")
    expect(screen.getByText("Moyennes disponibles")).toBeInTheDocument()
    cleanup()
    renderWorkspace("/academic/notes?tab=conduite")
    expect(screen.queryByText("Avis disponibles")).not.toBeInTheDocument()
    await waitFor(() => expect(decisionWorkspace).toHaveBeenCalled())
    expect(screen.queryByRole("tab", { name: /Conduite/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("tab=evaluations"))
    expect(screen.getByRole("tab", { name: "Évaluations" })).toHaveFocus()
    expect(screen.queryByRole("tab", { name: "Décisions" })).not.toBeInTheDocument()
  })

  it("explique l’échec d’une URL Décisions et propose un réessai", async () => {
    decisionWorkspace.mockRejectedValue(new Error("policy unavailable"))
    renderWorkspace("/academic/notes?tab=decisions")
    expect(screen.getByText("Évaluations disponibles")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeInTheDocument()
    expect(screen.queryByText("Décisions disponibles")).not.toBeInTheDocument()
  })

  it("affiche Décisions après confirmation de la portée serveur", async () => {
    decisionWorkspace.mockResolvedValue({ decisionScopes: [activeScope], decisionActions: [] })
    teacherActions.mockResolvedValue({ teacherOpenScopes: [{ ...teacherScope, pendingCount: 2 }], teacherActions: [{ ...teacherScope, pendingCount: 2 }] })
    renderWorkspace("/academic/notes?tab=decisions")
    expect(await screen.findByText("Décisions disponibles")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Décisions" })).toBeInTheDocument()
    expect(await screen.findByRole("tab", { name: "Conduite 2" })).toBeInTheDocument()
  })

  it("retire Décisions après le passage de la politique à Direction", async () => {
    decisionWorkspace.mockResolvedValueOnce({ decisionScopes: [activeScope], decisionActions: [] })
      .mockResolvedValue({ decisionScopes: [], decisionActions: [] })
    teacherActions.mockResolvedValue({ teacherOpenScopes: [teacherScope], teacherActions: [] })
    const { client } = renderWorkspace("/academic/notes?tab=decisions")
    expect(await screen.findByText("Décisions disponibles")).toBeInTheDocument()
    await client.invalidateQueries({ queryKey: ["conduct", "decision-workspace"] })
    expect(await screen.findByText("Avis disponibles")).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Décisions" })).not.toBeInTheDocument()
  })

  it("affiche Conduite sans badge lorsque tous les avis sont saisis", async () => {
    decisionWorkspace.mockResolvedValue({ decisionScopes: [], decisionActions: [] })
    teacherActions.mockResolvedValue({ teacherOpenScopes: [teacherScope], teacherActions: [] })
    renderWorkspace("/academic/notes?tab=conduite")
    expect(await screen.findByText("Avis disponibles")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Conduite" })).toBeInTheDocument()
  })

  it("ne montre pas une ancienne page Conduite depuis le cache avant la vérification serveur", async () => {
    decisionWorkspace.mockResolvedValue({ decisionScopes: [], decisionActions: [] })
    teacherActions.mockResolvedValue({ teacherOpenScopes: [], teacherActions: [] })
    renderWorkspace("/academic/notes?tab=conduite", { teacherOpenScopes: [teacherScope], teacherActions: [] })
    expect(screen.queryByText("Avis disponibles")).not.toBeInTheDocument()
    expect(await screen.findByText(/Aucune fenêtre de revue de conduite ouverte/)).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("tab=evaluations")
  })

  it("retire Conduite et annonce la fin de la fenêtre au rafraîchissement", async () => {
    decisionWorkspace.mockResolvedValue({ decisionScopes: [], decisionActions: [] })
    teacherActions.mockResolvedValueOnce({ teacherOpenScopes: [teacherScope], teacherActions: [] })
      .mockResolvedValue({ teacherOpenScopes: [], teacherActions: [] })
    const { client } = renderWorkspace("/academic/notes?tab=conduite")
    expect(await screen.findByText("Avis disponibles")).toBeInTheDocument()
    await client.invalidateQueries({ queryKey: ["conduct", "teacher-actions"] })
    expect(await screen.findByText(/Fenêtre de revue terminée/)).toBeInTheDocument()
    expect(screen.queryByText("Avis disponibles")).not.toBeInTheDocument()
    expect(screen.getByText("Évaluations disponibles")).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Conduite" })).not.toBeInTheDocument()
  })
})
