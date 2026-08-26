import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const fetchScope = vi.fn()

vi.mock("@/modules/academic/academic.api", async () => {
  const actual = await vi.importActual<typeof import("@/modules/academic/academic.api")>(
    "@/modules/academic/academic.api",
  )
  return {
    ...actual,
    listClasses: vi.fn().mockResolvedValue({ classes: [{ id: "c1", name: "6ème A" }] }),
    fetchEvaluationsScope: (...args: unknown[]) => fetchScope(...args),
    fetchClassCompletion: vi.fn().mockResolvedValue({
      subjects: [
        {
          subjectId: "s1",
          subjectName: "Mathématiques",
          subjectCoefficient: 4,
          status: "completed",
          completedAt: null,
          teacher: { id: "t1", name: "M. Diallo" },
        },
      ],
    }),
  }
})

vi.mock("@/shared/api/client", () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { gradingPeriods: [] } }) },
}))

import NotesPage from "@/modules/academic/NotesPage"

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("NotesPage", () => {
  it("affiche l'état vide tant qu'aucune classe/période n'est choisie", () => {
    renderWithClient(<NotesPage />)
    expect(screen.getByText("Choisissez une classe et une période")).toBeInTheDocument()
    expect(fetchScope).not.toHaveBeenCalled()
  })
})
